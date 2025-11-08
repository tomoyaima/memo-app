import { getDb, dropDb } from './idb'
import type { Note } from './models'

const sortByUpdated = (a: Note, b: Note) => b.updatedAt - a.updatedAt

export const getAllNotes = async () => {
  const db = await getDb()
  const tx = db.transaction('notes')
  const notes = await tx.store.getAll()
  return notes.sort(sortByUpdated)
}

export const getNote = async (id: string) => {
  const db = await getDb()
  return db.get('notes', id)
}

export const createNote = async (input: Partial<Note> = {}) => {
  const now = Date.now()
  const note: Note = {
    id: input.id ?? crypto.randomUUID(),
    ownerId: input.ownerId ?? 'local',
    title: input.title ?? '',
    contentHtml: input.contentHtml ?? '',
    tags: input.tags ?? [],
    pinned: input.pinned ?? false,
    updatedAt: now,
    deleted: input.deleted ?? false,
    dirty: true,
    encIv: input.encIv,
  }
  const db = await getDb()
  const tx = db.transaction('notes', 'readwrite')
  await tx.store.put(note)
  await tx.done
  return note
}

export const saveNote = async (note: Note) => {
  const db = await getDb()
  const tx = db.transaction('notes', 'readwrite')
  await tx.store.put({ ...note, dirty: note.dirty ?? true })
  await tx.done
}

export const archiveNote = async (noteId: string, archived: boolean) => {
  const note = await getNote(noteId)
  if (!note) return
  await saveNote({
    ...note,
    deleted: archived,
    dirty: true,
    updatedAt: Date.now(),
  })
}

export const deleteNote = async (noteId: string) => {
  const db = await getDb()
  const tx = db.transaction('notes', 'readwrite')
  await tx.store.delete(noteId)
  await tx.done
}

export const getDirtyNotes = async () => {
  const db = await getDb()
  const tx = db.transaction('notes')
  const notes = await tx.store.getAll()
  return notes.filter((note) => note.dirty)
}

export const markNotesClean = async (ids: string[]) => {
  const db = await getDb()
  const tx = db.transaction('notes', 'readwrite')
  for (const id of ids) {
    const note = await tx.store.get(id)
    if (!note) continue
    await tx.store.put({ ...note, dirty: false })
  }
  await tx.done
}

export const upsertMany = async (notes: Note[]) => {
  if (!notes.length) return
  const db = await getDb()
  const tx = db.transaction('notes', 'readwrite')
  for (const note of notes) {
    await tx.store.put({ ...note, dirty: false })
  }
  await tx.done
}

export const getMeta = async <T = unknown>(key: string) => {
  const db = await getDb()
  const record = await db.get('meta', key)
  return (record?.value as T | undefined) ?? undefined
}

export const setMeta = async (key: string, value: unknown) => {
  const db = await getDb()
  const tx = db.transaction('meta', 'readwrite')
  await tx.store.put({ key, value })
  await tx.done
}

export const clearDatabase = async () => {
  await dropDb()
}
