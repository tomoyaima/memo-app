export type NotePayload = {
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

export type SyncResponse = {
  changes: NotePayload[]
  cursor: number
}
