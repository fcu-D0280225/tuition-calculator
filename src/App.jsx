import { useEffect, useState } from 'react'
import { AppProviders } from './contexts/AppProviders.jsx'
import CoursesPage       from './pages/CoursesPage.jsx'
import StudentsPage      from './pages/StudentsPage.jsx'
import TeachersPage      from './pages/TeachersPage.jsx'
import LessonRecordsPage from './pages/LessonRecordsPage.jsx'
import SettlementPage    from './pages/SettlementPage.jsx'
import MaterialsPage     from './pages/MaterialsPage.jsx'
import LoginPage from './components/LoginPage.jsx'
import ChangePasswordDialog from './components/ChangePasswordDialog.jsx'
import { apiLogout, apiMe, clearToken, getToken, setOnUnauthorized } from './data/api.js'

const TABS = [
  { id: 'lessons',    label: '上課紀錄' },
  { id: 'settlement', label: '結算'     },
  { id: 'students',   label: '學生'     },
  { id: 'teachers',   label: '老師'     },
  { id: 'courses',    label: '課程'     },
  { id: 'materials',  label: '教材'     },
]

function AppShell({ user, onLogout, onChangePassword }) {
  const [tab, setTab] = useState('lessons')
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">補習班管理系統</div>
        <nav className="app-nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="app-user">
          <button
            type="button"
            className="app-user-btn"
            onClick={() => setMenuOpen(v => !v)}
          >
            {user.username}{user.role === 'admin' ? '（管理員）' : ''} ▾
          </button>
          {menuOpen && (
            <div className="app-user-menu" onMouseLeave={() => setMenuOpen(false)}>
              <button type="button" onClick={() => { setMenuOpen(false); onChangePassword() }}>變更密碼</button>
              <button type="button" onClick={() => { setMenuOpen(false); onLogout() }}>登出</button>
            </div>
          )}
        </div>
      </header>
      <main className="app-main">
        {tab === 'lessons'    && <LessonRecordsPage />}
        {tab === 'settlement' && <SettlementPage />}
        {tab === 'students'   && <StudentsPage />}
        {tab === 'teachers'   && <TeachersPage />}
        {tab === 'courses'    && <CoursesPage />}
        {tab === 'materials'  && <MaterialsPage />}
      </main>
    </div>
  )
}

export default function App() {
  const [authState, setAuthState] = useState('loading') // 'loading' | 'out' | 'in'
  const [user, setUser] = useState(null)
  const [showChangePassword, setShowChangePassword] = useState(false)

  useEffect(() => {
    setOnUnauthorized(() => {
      clearToken()
      setUser(null)
      setAuthState('out')
      setShowChangePassword(false)
    })

    let cancelled = false
    async function bootstrap() {
      if (!getToken()) { setAuthState('out'); return }
      try {
        const me = await apiMe()
        if (cancelled) return
        setUser(me)
        setAuthState('in')
        if (me.must_change) setShowChangePassword(true)
      } catch {
        if (cancelled) return
        clearToken()
        setAuthState('out')
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [])

  async function handleLogout() {
    await apiLogout()
    setUser(null)
    setAuthState('out')
    setShowChangePassword(false)
  }

  function handleLoggedIn(me) {
    setUser(me)
    setAuthState('in')
    if (me?.must_change) setShowChangePassword(true)
  }

  async function handleChangePasswordDone() {
    setShowChangePassword(false)
    try {
      const me = await apiMe()
      setUser(me)
    } catch { /* 401 handled by interceptor */ }
  }

  if (authState === 'loading') {
    return <div className="app--loading">載入中…</div>
  }
  if (authState === 'out') {
    return <LoginPage onLoggedIn={handleLoggedIn} />
  }
  if (showChangePassword && user?.must_change) {
    return <ChangePasswordDialog forced onDone={handleChangePasswordDone} />
  }
  return (
    <AppProviders>
      <AppShell
        user={user}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePassword(true)}
      />
      {showChangePassword && !user?.must_change && (
        <ChangePasswordDialog
          onDone={handleChangePasswordDone}
          onCancel={() => setShowChangePassword(false)}
        />
      )}
    </AppProviders>
  )
}
