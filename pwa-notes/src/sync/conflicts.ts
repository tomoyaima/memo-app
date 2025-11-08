import type { Note } from '../db/models'

export const resolveConflict = (local: Note, remote: Note) =>
  remote.updatedAt >= local.updatedAt ? remote : local

export const resolveIncomingChanges = (localNotes: Note[], remoteNotes: Note[]) => {
  const localMap = new Map(localNotes.map((note) => [note.id, note]))
  const toUpsert: Note[] = []
  const toDelete: string[] = []

  remoteNotes.forEach((remote) => {
    if (remote.deleted) {
      toDelete.push(remote.id)
      return
    }
    const current = localMap.get(remote.id)
    if (!current || remote.updatedAt > current.updatedAt) {
      toUpsert.push(remote)
    }
  })

  return { toUpsert, toDelete }
}
