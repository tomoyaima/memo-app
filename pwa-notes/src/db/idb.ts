import { openDB, type IDBPDatabase } from 'idb'
import type { NotesDB } from './models'

const DB_NAME = 'notes-pwa'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<NotesDB>> | undefined

export const getDb = () => {
  if (!dbPromise) {
    dbPromise = openDB<NotesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', {
            keyPath: 'id',
          })
          notesStore.createIndex('by-updated', 'updatedAt')
          notesStore.createIndex('by-dirty', 'dirty')
          notesStore.createIndex('by-tags', 'tags', { multiEntry: true })
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', {
            keyPath: 'key',
          })
        }
      },
    })
  }
  return dbPromise
}

export const dropDb = async () => {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = undefined
  }
  await indexedDB.deleteDatabase(DB_NAME)
}
