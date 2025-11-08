import { useMemo } from 'react'
import InstallPrompt from '../components/InstallPrompt'
import { useNotesContext } from '../hooks/useIndexedDB'
import { clearDatabase } from '../db/queries'
import { useAuth } from '../hooks/useAuth'

function Settings() {
  const { notes, lastSyncedAt, syncNow, refresh } = useNotesContext()
  const { provider, session, isAuthenticated, login, logout, loading, error } =
    useAuth()
  const stats = useMemo(
    () => ({
      total: notes.length,
      pinned: notes.filter((note) => note.pinned).length,
      archived: notes.filter((note) => note.deleted).length,
      dirty: notes.filter((note) => note.dirty).length,
    }),
    [notes],
  )

  const handleReset = async () => {
    await clearDatabase()
    await refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section className="section-card">
        <h2>同期とストレージ</h2>
        <div className="stat-grid">
          <div className="stat-card">
            <span>メモ数</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="stat-card">
            <span>ピン留め</span>
            <strong>{stats.pinned}</strong>
          </div>
          <div className="stat-card">
            <span>アーカイブ</span>
            <strong>{stats.archived}</strong>
          </div>
          <div className="stat-card">
            <span>未同期</span>
            <strong>{stats.dirty}</strong>
          </div>
        </div>
        <div className="inline-actions" style={{ marginTop: 20 }}>
          <div>
            <span style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              最終同期: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : '未同期'}
            </span>
          </div>
          <button type="button" className="primary-btn" onClick={syncNow}>
            今すぐ同期
          </button>
        </div>
      </section>
      <section className="section-card">
        <h2>認証</h2>
        <p style={{ marginTop: 0, color: 'var(--text-dim)' }}>
          現在のプロバイダー: {provider === 'cognito' ? 'Amazon Cognito (OIDC + PKCE)' : provider}
        </p>
        {provider === 'cognito' && (
          <div className="section-card" style={{ background: 'rgba(0,0,0,0.15)', marginTop: 16 }}>
            {isAuthenticated && session ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <strong>サインイン中</strong>
                  <p style={{ margin: 0, color: 'var(--text-dim)' }}>{session.username}</p>
                </div>
                <div className="inline-actions">
                  <button type="button" className="ghost-btn" onClick={logout}>
                    ログアウト
                  </button>
                  <span className="stat-card" style={{ background: 'transparent', padding: 0 }}>
                    <small style={{ color: 'var(--text-dim)' }}>
                      {new Date(session.issuedAt).toLocaleString()} に認証
                    </small>
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ margin: 0, color: 'var(--text-dim)' }}>
                  「Cognito にログイン」を押すと Hosted UI (Authorization Code + PKCE) にリダイレクトし、
                  サインイン後は自動で戻ってきます。
                </p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => login()}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {loading ? '遷移中...' : 'Cognito にログイン'}
                </button>
                {error && <small style={{ color: 'var(--danger)' }}>{error}</small>}
              </div>
            )}
          </div>
        )}
      </section>
      <section className="section-card">
        <h2>PWA</h2>
        <InstallPrompt variant="inline" />
      </section>
      <section className="section-card">
        <h2>メンテナンス</h2>
        <p style={{ color: 'var(--text-dim)' }}>
          ローカル IndexedDB を削除して初期状態に戻します。同期済みであることを確認してください。
        </p>
        <button type="button" className="danger-btn" onClick={handleReset}>
          ローカルデータを削除
        </button>
      </section>
    </div>
  )
}

export default Settings
