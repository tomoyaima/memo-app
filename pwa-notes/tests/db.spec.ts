import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import {
  archiveNote,
  clearDatabase,
  createNote,
  getAllNotes,
  getDirtyNotes,
  markNotesClean,
} from '../src/db/queries'

describe('IndexedDB helpers', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it('creates and reads notes', async () => {
    await createNote({ title: 'hello', tags: ['demo'], contentHtml: '<p>demo</p>' })
    const notes = await getAllNotes()
    expect(notes).toHaveLength(1)
    expect(notes[0].title).toBe('hello')
    expect(notes[0].tags).toContain('demo')
  })

  it('marks dirty notes as clean after sync', async () => {
    const note = await createNote({ title: 'dirty note' })
    const dirtyBefore = await getDirtyNotes()
    expect(dirtyBefore).toHaveLength(1)
    await markNotesClean([note.id])
    const dirtyAfter = await getDirtyNotes()
    expect(dirtyAfter).toHaveLength(0)
  })

  it('archives notes by toggling deleted flag', async () => {
    const note = await createNote({ title: 'to archive' })
    await archiveNote(note.id, true)
    const [archived] = await getAllNotes()
    expect(archived.deleted).toBe(true)
  })
})
