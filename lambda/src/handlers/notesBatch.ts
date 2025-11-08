import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { BatchWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamo.js'
import type { NotePayload } from '../types.js'

const NOTES_TABLE = process.env.NOTES_TABLE ?? 'notes-pwa'
const NOTES_ACL_TABLE = process.env.NOTES_ACL_TABLE

const chunk = <T>(items: T[], size = 25): T[][] => {
  const batched: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batched.push(items.slice(i, i + size))
  }
  return batched
}

const getUserId = (event: APIGatewayProxyEventV2) => {
  const auth = ((event.requestContext as any) ?? {}).authorizer ?? {}
  return auth.jwt?.claims?.sub ?? auth.claims?.sub ?? auth.principalId
}

const withCors = (response: APIGatewayProxyStructuredResultV2) => ({
  ...response,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
    ...response.headers,
  },
})

const hasEditAccess = async (userId: string, noteId: string) => {
  if (!NOTES_ACL_TABLE) return false
  const res = await docClient.send(
    new GetCommand({
      TableName: NOTES_ACL_TABLE,
      Key: { userId, noteId },
    }),
  )
  return Boolean(res.Item?.canEdit)
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const userId = getUserId(event)
  if (!userId) {
    return withCors({ statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) })
  }

  if (!event.body) {
    return withCors({ statusCode: 400, body: JSON.stringify({ message: 'Missing body' }) })
  }

  let changes: NotePayload[]
  try {
    const payload = JSON.parse(event.body)
    changes = Array.isArray(payload.changes) ? payload.changes : []
  } catch (error) {
    return withCors({
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid JSON body', details: String(error) }),
    })
  }

  if (!changes.length) {
    return withCors({ statusCode: 200, body: JSON.stringify({ updated: 0 }) })
  }

  const putRequests: any[] = []

  for (const note of changes) {
    let ownerId = note.ownerId ?? userId
    const ownerToCheck = note.ownerId ?? userId
    const existing = await docClient.send(
      new GetCommand({
        TableName: NOTES_TABLE,
        Key: { userId: ownerToCheck, noteId: note.id },
      }),
    )
    if (existing.Item) {
      ownerId = (existing.Item.ownerId as string) ?? (existing.Item.userId as string) ?? ownerId
      if (ownerId !== userId) {
        const allowed = await hasEditAccess(userId, note.id)
        if (!allowed) {
          return withCors({
            statusCode: 403,
            body: JSON.stringify({ message: `No edit access for note ${note.id}` }),
          })
        }
      }
    }

    putRequests.push({
      PutRequest: {
        Item: {
          userId: ownerId,
          ownerId,
          noteId: note.id,
          title: note.title ?? '',
          contentHtml: note.contentHtml ?? '',
          tags: note.tags ?? [],
          pinned: Boolean(note.pinned),
          deleted: Boolean(note.deleted),
          encIv: note.encIv ?? null,
          updatedAt: note.updatedAt ?? Date.now(),
          gsiUpdatedAtPk: ownerId,
          gsiUpdatedAtSk: note.updatedAt ?? Date.now(),
        },
      },
    })
  }

  const batches = chunk(putRequests, 25)
  for (const items of batches) {
    let unprocessed = items
    let retry = 0
    while (unprocessed.length) {
      const response = await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [NOTES_TABLE]: unprocessed as any,
          },
        }),
      )
      const next = response.UnprocessedItems?.[NOTES_TABLE]
      unprocessed = next ?? []
      if (unprocessed.length) {
        if (retry >= 5) {
          return withCors({
            statusCode: 500,
            body: JSON.stringify({
              message: 'Failed to persist some notes',
              unprocessed: unprocessed.length,
            }),
          })
        }
        await new Promise((resolve) => setTimeout(resolve, 2 ** retry * 100))
        retry += 1
      }
    }
  }

  return withCors({ statusCode: 200, body: JSON.stringify({ updated: changes.length }) })
}
