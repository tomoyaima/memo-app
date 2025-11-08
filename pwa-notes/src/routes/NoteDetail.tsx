import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NoteEditor from '../components/Editor'
import { useNotesContext } from '../hooks/useIndexedDB'
import type { Note } from '../db/models'
import { useAuth } from '../hooks/useAuth'
import { shareNote, type ShareAccess, type ShareAction } from '../sync/api'

function NoteDetail() {
  const { noteId } = useParams<{ noteId: string }>()
  const navigate = useNavigate()
  const { notes, updateNote, deleteNote, toggleArchive, togglePin, getNote } = useNotesContext()
  const { session } = useAuth()
  const [draft, setDraft] = useState<Note | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [shareUserId, setShareUserId] = useState('')
  const [shareAccess, setShareAccess] = useState<ShareAccess>('viewer')
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  useEffect(() => {
    if (!noteId) {
      setDraft(null)
      return
    }
    const current = notes.find((note) => note.id === noteId)
    if (current) {
      setDraft(current)
      return
    }
    getNote(noteId).then((result) => {
      setDraft(result ?? null)
    })
  }, [notes, noteId, getNote])

  const handleTitle = (value: string) =>
    setDraft((prev) => (prev ? { ...prev, title: value } : prev))
  const handleTags = (value: string) => {
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    setDraft((prev) => (prev ? { ...prev, tags } : prev))
  }
  const handleContent = (value: string) =>
    setDraft((prev) => (prev ? { ...prev, contentHtml: value } : prev))

  useEffect(() => {
    if (!savedAt) return
    const timer = window.setTimeout(() => setSavedAt(null), 3000)
    return () => window.clearTimeout(timer)
  }, [savedAt])

  const handleSave = async () => {
    if (!draft) return
    try {
      setIsSaving(true)
      await updateNote(draft)
      setError(null)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!draft) return
    await deleteNote(draft.id)
    navigate('/')
  }

  const handlePin = async () => {
    if (!draft) return
    await togglePin(draft.id, !draft.pinned)
    setDraft({ ...draft, pinned: !draft.pinned })
  }

  const handleArchive = async () => {
    if (!draft) return
    await toggleArchive(draft.id, !draft.deleted)
    setDraft({ ...draft, deleted: !draft.deleted })
  }

  const isOwner = session?.userId && draft?.ownerId ? session.userId === draft.ownerId : !draft?.ownerId && !!session?.userId

  const handleShareAction = async (action: ShareAction) => {
    if (!draft || !shareUserId) return
    setShareLoading(true)
    setShareMessage(null)
    setShareError(null)
    try {
      await shareNote({
        noteId: draft.id,
        targetUserId: shareUserId,
        access: shareAccess,
        action,
      })
      setShareMessage(action === 'grant' ? '共有設定を更新しました' : '共有を解除しました')
      if (action === 'grant') {
        setShareUserId('')
        setShareAccess('viewer')
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : '共有設定に失敗しました')
    } finally {
      setShareLoading(false)
    }
  }

  if (!noteId) {
    return (
      <section className="section-card">
        <p>メモが選択されていません。</p>
      </section>
    )
  }

  if (!draft) {
    return (
      <section className="section-card">
        <p>メモを読み込んでいます...</p>
      </section>
    )
  }

  return (
    <div className="section-card">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <input
          type="text"
          className="text-field"
          placeholder="タイトル"
          value={draft.title}
          onChange={(event) => handleTitle(event.target.value)}
        />
        <input
          type="text"
          className="text-field"
          placeholder="カンマ区切りでタグを追加"
          value={draft.tags.join(', ')}
          onChange={(event) => handleTags(event.target.value)}
        />
        <div className="inline-actions">
          <button type="button" className="ghost-btn" onClick={handlePin}>
            {draft.pinned ? 'ピン解除' : 'ピン留め'}
          </button>
          <button type="button" className="ghost-btn" onClick={handleArchive}>
            {draft.deleted ? '復元' : 'アーカイブへ'}
          </button>
          <button type="button" className="danger-btn" onClick={handleDelete}>
            完全削除
          </button>
        </div>
        <div className="editor-wrapper">
          <NoteEditor value={draft.contentHtml} onChange={handleContent} placeholder="本文を入力" />
        </div>
        <small style={{ color: 'var(--text-dim)' }}>
          所有者: {draft.ownerId || session?.userId || 'ローカル'}
        </small>
        <div className="inline-actions" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <small style={{ color: 'var(--text-dim)', display: 'block' }}>
              更新日時: {new Date(draft.updatedAt).toLocaleString()}
            </small>
            {savedAt && (
              <small style={{ color: 'var(--success)' }}>
                保存完了 ({new Date(savedAt).toLocaleTimeString('ja-JP')})
              </small>
            )}
            {error && (
              <small style={{ color: 'var(--danger)', display: 'block' }}>{error}</small>
            )}
          </div>
          <button type="button" className="primary-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
        {isOwner && (
          <div className="section-card" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <h3>共有</h3>
            <p style={{ color: 'var(--text-dim)', marginTop: 0 }}>
              Cognito のユーザー ID（sub）を指定して閲覧/編集権限を付与します。
            </p>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <input
                type="text"
                className="text-field"
                placeholder="ユーザーID (sub)"
                value={shareUserId}
                onChange={(event) => setShareUserId(event.target.value)}
              />
              <select
                className="select-field"
                value={shareAccess}
                onChange={(event) => setShareAccess(event.target.value as ShareAccess)}
              >
                <option value="viewer">閲覧のみ</option>
                <option value="editor">編集可</option>
              </select>
            </div>
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="primary-btn"
                disabled={!shareUserId || shareLoading}
                onClick={() => handleShareAction('grant')}
              >
                {shareLoading ? '送信中...' : '共有を追加'}
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={!shareUserId || shareLoading}
                onClick={() => handleShareAction('revoke')}
              >
                共有解除
              </button>
            </div>
            {shareMessage && <small style={{ color: 'var(--success)' }}>{shareMessage}</small>}
            {shareError && <small style={{ color: 'var(--danger)' }}>{shareError}</small>}
          </div>
        )}
      </div>
    </div>
  )
}

export default NoteDetail
