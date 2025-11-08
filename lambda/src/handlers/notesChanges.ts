import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamo.js'
import type { NotePayload, SyncResponse } from '../types.js'

const NOTES_TABLE = process.env.NOTES_TABLE ?? 'notes-pwa'
const UPDATED_GSI = process.env.NOTES_UPDATED_AT_GSI ?? 'gsiUpdatedAt'
const NOTES_ACL_TABLE = process.env.NOTES_ACL_TABLE
const MAX_CHANGES = Number(process.env.MAX_CHANGES ?? 200)

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

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const userId = getUserId(event)
  if (!userId) {
    return withCors({ statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) })
  }

  const sinceParam = event.queryStringParameters?.since
  const since = Number.isFinite(Number(sinceParam)) ? Number(sinceParam) : 0

  const items: NotePayload[] = []
  const seen = new Set<string>()
  let lastEvaluatedKey: Record<string, unknown> | undefined

  do {
    const response = await docClient.send(
      new QueryCommand({
        TableName: NOTES_TABLE,
        IndexName: UPDATED_GSI,
        KeyConditionExpression: '#pk = :pk AND #updatedAt > :since',
        ExpressionAttributeNames: {
          '#pk': 'gsiUpdatedAtPk',
          '#updatedAt': 'gsiUpdatedAtSk',
        },
        ExpressionAttributeValues: {
          ':pk': userId,
          ':since': since,
        },
        Limit: MAX_CHANGES,
        ExclusiveStartKey: lastEvaluatedKey,
        ScanIndexForward: true,
      }),
    )

    const notes = (response.Items ?? []).map((item: Record<string, unknown>) => ({
      id: item.noteId as string,
      ownerId: (item.ownerId as string) ?? (item.userId as string) ?? userId,
      title: (item.title as string) ?? '',
      contentHtml: (item.contentHtml as string) ?? '',
      tags: (item.tags as string[]) ?? [],
      pinned: Boolean(item.pinned),
      updatedAt: Number(item.updatedAt ?? item.gsiUpdatedAtSk ?? Date.now()),
      deleted: Boolean(item.deleted),
      encIv: (item.encIv as string) ?? undefined,
    }))

    for (const note of notes) {
      if (seen.has(note.id)) continue
      items.push(note)
      seen.add(note.id)
    }

    if ((response.Items?.length ?? 0) >= MAX_CHANGES) {
      lastEvaluatedKey = response.LastEvaluatedKey
    } else {
      lastEvaluatedKey = undefined
    }

    if (items.length >= MAX_CHANGES) break
  } while (lastEvaluatedKey)

  if (NOTES_ACL_TABLE) {
    const aclResponse = await docClient.send(
      new QueryCommand({
        TableName: NOTES_ACL_TABLE,
        KeyConditionExpression: '#pk = :pk',
        ExpressionAttributeNames: { '#pk': 'userId' },
        ExpressionAttributeValues: { ':pk': userId },
      }),
    )

    for (const entry of aclResponse.Items ?? []) {
      if (items.length >= MAX_CHANGES) break
      const noteId = entry.noteId as string
      const ownerId = (entry.ownerId as string) ?? ''
      if (!noteId || !ownerId || seen.has(noteId)) continue
      const noteRes = await docClient.send(
        new GetCommand({
          TableName: NOTES_TABLE,
          Key: { userId: ownerId, noteId },
        }),
      )
      const item = noteRes.Item
      if (!item) continue
      const note: NotePayload = {
        id: noteId,
        ownerId,
        title: (item.title as string) ?? '',
        contentHtml: (item.contentHtml as string) ?? '',
        tags: (item.tags as string[]) ?? [],
        pinned: Boolean(item.pinned),
        updatedAt: Number(item.updatedAt ?? Date.now()),
        deleted: Boolean(item.deleted),
        encIv: (item.encIv as string) ?? undefined,
      }
      if (note.updatedAt <= since) continue
      items.push(note)
      seen.add(note.id)
      if (items.length >= MAX_CHANGES) break
    }
  }

  const payload: SyncResponse = {
    changes: items.slice(0, MAX_CHANGES),
    cursor: Date.now(),
  }

  return withCors({ statusCode: 200, body: JSON.stringify(payload) })
}
