import { useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import Home from './routes/Home'
import NoteDetail from './routes/NoteDetail'
import Settings from './routes/Settings'
import AuthCallback from './routes/AuthCallback'
import { NotesProvider } from './hooks/useIndexedDB'
import { AuthProvider, useAuth } from './hooks/useAuth'

const navLinks = [
  { to: '/', label: 'ホーム', end: true },
  { to: '/settings', label: '設定' },
]

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { login, logout, isAuthenticated, loading, provider } = useAuth()
  const handleAuthClick = () => {
    if (isAuthenticated) {
      logout()
    } else if (provider === 'cognito') {
      login()
    }
    if (onNavigate) onNavigate()
  }

  return (
    <>
      <nav className="nav-links">
        {navLinks.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            onClick={onNavigate}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {provider === 'cognito' && (
        <button type="button" className="ghost-btn" onClick={handleAuthClick} disabled={loading}>
          {isAuthenticated ? 'ログアウト' : loading ? '遷移中...' : 'ログイン'}
        </button>
      )}
    </>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const toggleMenu = () => setMenuOpen((prev) => !prev)
  const closeMenu = () => setMenuOpen(false)

  return (
    <AuthProvider>
      <NotesProvider>
        <BrowserRouter>
          <div className={`app-shell ${menuOpen ? 'menu-open' : ''}`}>
            <aside className="app-aside">
              <div>
                <div className="app-logo">Notes PWA</div>
                <p style={{ color: 'var(--text-dim)', margin: '8px 0 0' }}>
                  オフラインメモ / TinyMCE / IndexedDB
                </p>
              </div>
              <div className="desktop-nav">
                <Navigation />
              </div>
            </aside>
            <button
              type="button"
              className="hamburger-btn"
              onClick={toggleMenu}
              aria-label="メニュー"
            >
              <span />
              <span />
              <span />
            </button>
            {menuOpen && (
              <div className="mobile-nav-drawer">
                <Navigation onNavigate={closeMenu} />
              </div>
            )}
            <main className="app-main">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/notes/:noteId" element={<NoteDetail />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </NotesProvider>
    </AuthProvider>
  )
}

export default App
