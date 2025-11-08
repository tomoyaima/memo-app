import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import type { Note } from '../db/models'
import {
  archiveNote as archiveNoteQuery,
  createNote as createNoteQuery,
  deleteNote as deleteNoteQuery,
  getAllNotes,
  getMeta,
  getNote as getNoteQuery,
  getDirtyNotes,
  markNotesClean,
  saveNote,
  setMeta,
  upsertMany,
} from '../db/queries'
import { pullSince, pushChanges } from '../sync/api'
import { resolveIncomingChanges } from '../sync/conflicts'
import { useAuth } from './useAuth'

type NotesContextValue = {
  notes: Note[]
  loading: boolean
  lastSyncedAt: number
  createNote: (input?: Partial<Note>) => Promise<Note>
  updateNote: (note: Note) => Promise<void>
  togglePin: (noteId: string, pinned: boolean) => Promise<void>
  toggleArchive: (noteId: string, archived: boolean) => Promise<void>
  deleteNote: (noteId: string) => Promise<void>
  getNote: (noteId: string) => Promise<Note | undefined>
  refresh: () => Promise<void>
  syncNow: () => Promise<void>
}

const NotesContext = createContext<NotesContextValue | undefined>(undefined)

const NotesProvider = ({ children }: PropsWithChildren) => {
  const { session } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSyncedAt, setLastSyncedAt] = useState(0)
  const isSyncing = useRef(false)
  const notesSnapshot = useRef<Note[]>([])

  const refresh = useCallback(async () => {
    const [list, synced] = await Promise.all([getAllNotes(), getMeta<number>('lastSyncAt')])
    setNotes(list)
    notesSnapshot.current = list
    setLastSyncedAt(synced ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const currentUserId = session?.userId ?? 'local'

  const createNote = useCallback(
    async (input?: Partial<Note>) => {
      const payload: Partial<Note> = {
        ...input,
        ownerId: input?.ownerId ?? currentUserId,
      }
      const note = await createNoteQuery(payload)
      await refresh()
      return note
    },
    [refresh, currentUserId],
  )

  const updateNote = useCallback(
    async (note: Note) => {
      await saveNote({
        ...note,
        ownerId: note.ownerId ?? currentUserId,
        updatedAt: Date.now(),
        dirty: true,
      })
      await refresh()
    },
    [refresh, currentUserId],
  )

  const togglePin = useCallback(
    async (noteId: string, pinned: boolean) => {
      const note = await getNoteQuery(noteId)
      if (!note) return
      await saveNote({
        ...note,
        ownerId: note.ownerId ?? currentUserId,
        pinned,
        dirty: true,
        updatedAt: Date.now(),
      })
      await refresh()
    },
    [refresh, currentUserId],
  )

  const toggleArchive = useCallback(
    async (noteId: string, archived: boolean) => {
      await archiveNoteQuery(noteId, archived)
      await refresh()
    },
    [refresh],
  )

  const deleteNote = useCallback(
    async (noteId: string) => {
      await deleteNoteQuery(noteId)
      await refresh()
    },
    [refresh],
  )

  const getNote = useCallback(async (noteId: string) => getNoteQuery(noteId), [])

  const syncNow = useCallback(async () => {
    if (isSyncing.current) return
    isSyncing.current = true
    try {
      const dirty = await getDirtyNotes()
      if (dirty.length) {
        await pushChanges(dirty)
        await markNotesClean(dirty.map((note) => note.id))
      }
      const since = (await getMeta<number>('lastSyncAt')) ?? 0
      const payload = await pullSince(since)
      if (payload && payload.changes && payload.changes.length) {
        const merged = resolveIncomingChanges(notesSnapshot.current, payload.changes)
        if (merged.toUpsert.length) {
          await upsertMany(merged.toUpsert)
        }
        if (merged.toDelete.length) {
          await Promise.all(merged.toDelete.map((id) => deleteNoteQuery(id)))
        }
        await setMeta('lastSyncAt', payload.cursor ?? Date.now())
      }
    } catch (error) {
      console.warn('sync failed (offline ok)', error)
    } finally {
      isSyncing.current = false
      refresh()
    }
  }, [refresh])

  useEffect(() => {
    if (navigator.onLine) {
      syncNow()
    }
    const handleOnline = () => syncNow()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [syncNow])

  const value = useMemo<NotesContextValue>(
    () => ({
      notes,
      loading,
      lastSyncedAt,
      createNote,
      updateNote,
      togglePin,
      toggleArchive,
      deleteNote,
      getNote,
      refresh,
      syncNow,
    }),
    [
      notes,
      loading,
      lastSyncedAt,
      createNote,
      updateNote,
      togglePin,
      toggleArchive,
      deleteNote,
      getNote,
      refresh,
      syncNow,
    ],
  )

  return <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
}

const useNotesContext = () => {
  const ctx = useContext(NotesContext)
  if (!ctx) {
    throw new Error('useNotesContext must be used inside <NotesProvider />')
  }
  return ctx
}

export { NotesProvider, useNotesContext }
