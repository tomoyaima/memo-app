import type { Note } from '../db/models'

type Props = {
  note: Note
  onSelect: (noteId: string) => void
  onTogglePin: (note: Note) => void
  onToggleArchive: (note: Note) => void
}

const formatDate = (value: number) =>
  new Date(value).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const toPlainText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

function NoteCard({ note, onSelect, onTogglePin, onToggleArchive }: Props) {
  return (
    <article className="note-card" onClick={() => onSelect(note.id)}>
      <div className="note-meta" style={{ fontWeight: 600 }}>
        <span>{note.title || '（無題）'}</span>
        {note.pinned && <span>📌</span>}
      </div>
      <p style={{ color: 'var(--text-dim)', minHeight: 64 }}>
        {toPlainText(note.contentHtml || '').slice(0, 120) || '本文はまだありません'}
      </p>
      <div className="tag-cloud">
        {note.tags.map((tag) => (
          <span key={tag} className="tag-chip">
            #{tag}
          </span>
        ))}
      </div>
      <div className="note-meta">
        <span>{formatDate(note.updatedAt)}</span>
        <div className="inline-actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={(event) => {
              event.stopPropagation()
              onTogglePin(note)
            }}
          >
            {note.pinned ? 'ピン解除' : 'ピン留め'}
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={(event) => {
              event.stopPropagation()
              onToggleArchive(note)
            }}
          >
            {note.deleted ? '復元' : 'アーカイブ'}
          </button>
        </div>
      </div>
    </article>
  )
}

export default NoteCard
