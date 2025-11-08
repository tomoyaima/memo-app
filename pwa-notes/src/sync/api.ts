import type { Note } from '../db/models'
import { getCurrentSession } from '../auth/session'

export type PullResponse = { changes: Note[]; cursor: number } | null

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

const withAuthHeaders = (headers: HeadersInit = {}) => {
  const session = getCurrentSession()
  if (session?.provider === 'cognito' && session.accessToken) {
    return {
      ...headers,
      Authorization: `Bearer ${session.accessToken}`,
    }
  }
  return headers
}

export const pushChanges = async (changes: Note[]) => {
  if (!changes.length) return { ok: true }
  try {
    const response = await fetch(`${BASE_URL}/notes/batch`, {
      method: 'POST',
      headers: withAuthHeaders({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ changes }),
    })
    if (!response.ok) {
      throw new Error(`push failed (${response.status})`)
    }
    return response.json()
  } catch (error) {
    console.debug('pushChanges skipped (offline?)', error)
    return null
  }
}

export const pullSince = async (since: number): Promise<PullResponse> => {
  try {
    const response = await fetch(`${BASE_URL}/notes/changes?since=${since}`, {
      headers: withAuthHeaders(),
    })
    if (!response.ok) {
      throw new Error(`pull failed (${response.status})`)
    }
    return response.json()
  } catch (error) {
    console.debug('pullSince skipped (offline?)', error)
    return null
  }
}

export type ShareAccess = 'viewer' | 'editor'
export type ShareAction = 'grant' | 'revoke'

export const shareNote = async (input: {
  noteId: string
  targetUserId: string
  access: ShareAccess
  action: ShareAction
}) => {
  const response = await fetch(`${BASE_URL}/notes/share`, {
    method: 'POST',
    headers: withAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error('共有設定に失敗しました')
  }
  return response.json()
}
