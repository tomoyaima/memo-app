import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NoteCard from '../components/NoteCard'
import InstallPrompt from '../components/InstallPrompt'
import { useNotesContext } from '../hooks/useIndexedDB'
import type { Note } from '../db/models'

const cleanText = (note: Note) =>
  `${note.title} ${note.tags.join(' ')} ${note.contentHtml}`
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()

function Home() {
  const { notes, createNote, togglePin, toggleArchive, loading } = useNotesContext()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [pinnedOnly, setPinnedOnly] = useState(false)

  const tags = useMemo(() => {
    const all = new Set<string>()
    notes.forEach((note) => note.tags.forEach((tag) => all.add(tag)))
    return Array.from(all).sort()
  }, [notes])

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    return notes.filter((note) => {
      if (!showArchived && note.deleted) return false
      if (pinnedOnly && !note.pinned) return false
      if (selectedTags.length && !selectedTags.every((tag) => note.tags.includes(tag))) return false
      if (!normalized) return true
      return cleanText(note).includes(normalized)
    })
  }, [notes, search, showArchived, pinnedOnly, selectedTags])

  const pinned = filtered.filter((note) => note.pinned)
  const others = filtered.filter((note) => !note.pinned)

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    )
  }

  const handleCreate = async () => {
    const note = await createNote({
      title: '新しいメモ',
      contentHtml: '<p>ここに本文を書き始めましょう</p>',
    })
    navigate(`/notes/${note.id}`)
  }

  const handleSelect = (noteId: string) => navigate(`/notes/${noteId}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <InstallPrompt />
      <section className="section-card">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 8px' }}>メモ一覧</h1>
            <p style={{ margin: 0, color: 'var(--text-dim)' }}>
              オフラインで編集・検索できるリッチテキストメモ
            </p>
          </div>
          <button type="button" className="primary-btn" onClick={handleCreate}>
            + 新規メモ
          </button>
        </div>
        <div className="form-grid" style={{ marginTop: 24 }}>
          <input
            type="search"
            className="text-field"
            placeholder="全文検索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="inline-actions">
            <label className="pill-toggle">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              アーカイブを表示
            </label>
            <label className="pill-toggle">
              <input
                type="checkbox"
                checked={pinnedOnly}
                onChange={(event) => setPinnedOnly(event.target.checked)}
              />
              ピン留めのみ
            </label>
          </div>
        </div>
        <div className="tag-list" style={{ marginTop: 16 }}>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`tag-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
              onClick={() => handleToggleTag(tag)}
            >
              #{tag}
            </button>
          ))}
          {tags.length === 0 && (
            <span style={{ color: 'var(--text-dim)' }}>タグはまだありません</span>
          )}
        </div>
      </section>
      {loading ? (
        <section className="section-card">同期中...</section>
      ) : (
        <>
          {pinned.length > 0 && (
            <section className="section-card">
              <h2>ピン留め</h2>
              <div className="notes-grid">
                {pinned.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onSelect={handleSelect}
                    onTogglePin={(target) => togglePin(target.id, !target.pinned)}
                    onToggleArchive={(target) => toggleArchive(target.id, !target.deleted)}
                  />
                ))}
              </div>
            </section>
          )}
          <section className="section-card">
            <h2>その他のメモ</h2>
            {others.length === 0 ? (
              <p style={{ color: 'var(--text-dim)' }}>対象のメモはありません</p>
            ) : (
              <div className="notes-grid">
                {others.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onSelect={handleSelect}
                    onTogglePin={(target) => togglePin(target.id, !target.pinned)}
                    onToggleArchive={(target) => toggleArchive(target.id, !target.deleted)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default Home
