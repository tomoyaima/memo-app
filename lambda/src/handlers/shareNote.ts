import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { docClient } from '../shared/dynamo.js'

const NOTES_TABLE = process.env.NOTES_TABLE ?? 'notes-pwa'
const NOTES_ACL_TABLE = process.env.NOTES_ACL_TABLE ?? 'notes-acl'

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

type SharePayload = {
  noteId: string
  targetUserId: string
  access: 'viewer' | 'editor'
  action: 'grant' | 'revoke'
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

  let payload: SharePayload
  try {
    payload = JSON.parse(event.body)
  } catch (error) {
    return withCors({
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid payload', details: String(error) }),
    })
  }

  if (!payload.noteId || !payload.targetUserId) {
    return withCors({
      statusCode: 400,
      body: JSON.stringify({ message: 'noteId と targetUserId は必須です' }),
    })
  }

  const note = await docClient.send(
    new GetCommand({
      TableName: NOTES_TABLE,
      Key: { userId, noteId: payload.noteId },
    }),
  )

  if (!note.Item) {
    return withCors({ statusCode: 404, body: JSON.stringify({ message: 'note not found' }) })
  }

  if (payload.action === 'grant') {
    await docClient.send(
      new PutCommand({
        TableName: NOTES_ACL_TABLE,
        Item: {
          userId: payload.targetUserId,
          noteId: payload.noteId,
          ownerId: userId,
          canEdit: payload.access === 'editor',
          updatedAt: Date.now(),
        },
      }),
    )
  } else {
    await docClient.send(
      new DeleteCommand({
        TableName: NOTES_ACL_TABLE,
        Key: { userId: payload.targetUserId, noteId: payload.noteId },
      }),
    )
  }

  return withCors({ statusCode: 200, body: JSON.stringify({ ok: true }) })
}
