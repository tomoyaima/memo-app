import type { DBSchema } from 'idb'

export type Note = {
  id: string
  ownerId: string
  title: string
  contentHtml: string
  tags: string[]
  pinned: boolean
  updatedAt: number
  deleted?: boolean
  dirty?: boolean
  encIv?: string
}

export type MetaRecord<T = unknown> = {
  key: string
  value: T
}

export interface NotesDB extends DBSchema {
  notes: {
    key: string
    value: Note
    indexes: {
      'by-updated': number
      'by-dirty': number
      'by-tags': string
    }
  }
  meta: {
    key: string
    value: MetaRecord
  }
}
