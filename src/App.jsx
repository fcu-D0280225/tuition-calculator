import { useEffect, useMemo, useState } from 'react'
import { AppProviders } from './contexts/AppProviders.jsx'
import CoursesPage       from './pages/CoursesPage.jsx'
import StudentsPage      from './pages/StudentsPage.jsx'
import TeachersPage      from './pages/TeachersPage.jsx'
import LessonRecordsPage from './pages/LessonRecordsPage.jsx'
import SettlementPage    from './pages/SettlementPage.jsx'
import MaterialsPage     from './pages/MaterialsPage.jsx'
import GroupsPage        from './pages/GroupsPage.jsx'
import DashboardPage     from './pages/DashboardPage.jsx'
import AttendancePage    from './pages/AttendancePage.jsx'
import SchedulePage      from './pages/SchedulePage.jsx'
import UsersPage         from './pages/UsersPage.jsx'
import LoginPage         from './pages/LoginPage.jsx'
import { apiAuthMe, apiAuthLogout } from './data/api.js'

const NAV = [
  { type: 'tab', id: 'dashboard', label: '財務總覽' },
  { type: 'group', key: 'courses', label: '課程', children: [
    { id: 'courses', label: '家教課' },
    { id: 'groups',  label: '團課' },
  ]},
  { type: 'group', key: 'people', label: '人員', children: [
    { id: 'students', label: '學生' },
    { id: 'teachers', label: '老師' },
  ]},
  { type: 'group', key: 'records', label: '紀錄', children: [
    { id: 'lessons',    label: '上課紀錄' },
    { id: 'attendance', label: '點名' },
    { id: 'materials',  label: '教材' },
  ]},
  { type: 'tab', id: 'schedule', label: '課表' },
  { type: 'tab', id: 'settlement', label: '結算' },
  { type: 'tab', id: 'users', label: '使用者管理' },
]

function filterNav(perms, isAdmin) {
  const has = id => isAdmin || perms.includes(id) || (id === 'users' && isAdmin)
  return NAV
    .map(item => {
      if (item.type === 'tab') {
        if (item.id === 'users') return isAdmin ? item : null
        return has(item.id) ? item : null
      }
      const children = item.children.filter(c => has(c.id))
      return children.length ? { ...item, children } : null
    })
    .filter(Boolean)
}

function firstAllowedTab(visibleNav) {
  for (const item of visibleNav) {
    if (item.type === 'tab') return item.id
    if (item.children?.length) return item.children[0].id
  }
  return null
}

export default function App() {
  const [tab, setTab] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authState, setAuthState] = useState({ status: 'loading', user: null, is_admin: false, permissions: [] })

  useEffect(() => {
    let cancelled = false
    apiAuthMe()
      .then(({ user, is_admin, permissions }) => {
        if (!cancelled) setAuthState({ status: 'authed', user, is_admin: !!is_admin, permissions: permissions || [] })
      })
      .catch(() => { if (!cancelled) setAuthState({ status: 'guest', user: null, is_admin: false, permissions: [] }) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function onUnauthorized() {
      setAuthState({ status: 'guest', user: null, is_admin: false, permissions: [] })
      setTab(null)
    }
    window.addEventListener('auth:unauthorized', onUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized)
  }, [])

  const visibleNav = useMemo(
    () => filterNav(authState.permissions, authState.is_admin),
    [authState.permissions, authState.is_admin]
  )
  const allowedTabIds = useMemo(() => {
    const ids = new Set()
    for (const item of visibleNav) {
      if (item.type === 'tab') ids.add(item.id)
      else item.children.forEach(c => ids.add(c.id))
    }
    return ids
  }, [visibleNav])

  // 登入或權限變動時，重新對齊 active tab
  useEffect(() => {
    if (authState.status !== 'authed') return
    if (!tab || !allowedTabIds.has(tab)) {
      setTab(firstAllowedTab(visibleNav))
    }
  }, [authState.status, allowedTabIds, visibleNav, tab])

  async function handleLogout() {
    try { await apiAuthLogout() } catch { /* ignore */ }
    setAuthState({ status: 'guest', user: null, is_admin: false, permissions: [] })
    setTab(null)
    setSidebarOpen(false)
  }

  function navigate(id) {
    setTab(id)
    setSidebarOpen(false)
  }

  if (authState.status === 'loading') {
    return <div className="login-shell"><div className="login-loading">載入中…</div></div>
  }
  if (authState.status !== 'authed') {
    return <LoginPage onLoggedIn={({ user, is_admin, permissions }) => setAuthState({ status: 'authed', user, is_admin: !!is_admin, permissions: permissions || [] })} />
  }

  return (
    <AppProviders>
      <div className="app-shell">
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={`app-sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="app-sidebar-header">
            <div className="app-title">補習班管理系統</div>
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="關閉選單"
            >✕</button>
          </div>
          <nav className="app-nav">
            {visibleNav.map(item => item.type === 'group' ? (
              <div className="nav-section" key={item.key}>
                <div className="nav-section-label">{item.label}</div>
                {item.children.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={`nav-tab ${tab === c.id ? 'active' : ''}`}
                    onClick={() => navigate(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                key={item.id}
                type="button"
                className={`nav-tab ${tab === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
              >
                {item.label}
              </button>
            ))}
            {visibleNav.length === 0 && (
              <div className="empty-hint" style={{ padding: '12px 8px' }}>尚未指派任何頁面權限</div>
            )}
          </nav>
          <div className="app-sidebar-footer">
            <div className="app-user-name">
              {authState.user?.username}
              {authState.is_admin && <span className="users-self-tag">（管理員）</span>}
            </div>
            <button type="button" className="logout-btn" onClick={handleLogout}>登出</button>
          </div>
        </aside>

        <div className="app-content">
          <header className="mobile-topbar">
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="開啟選單"
            >
              <span />
              <span />
              <span />
            </button>
            <span className="mobile-topbar-title">補習班管理系統</span>
          </header>

          <main className="app-main">
            {tab === 'dashboard'  && <DashboardPage />}
            {tab === 'lessons'    && <LessonRecordsPage />}
            {tab === 'settlement' && <SettlementPage />}
            {tab === 'students'   && <StudentsPage />}
            {tab === 'teachers'   && <TeachersPage />}
            {tab === 'courses'    && <CoursesPage />}
            {tab === 'materials'  && <MaterialsPage />}
            {tab === 'groups'     && <GroupsPage />}
            {tab === 'attendance' && <AttendancePage />}
            {tab === 'schedule'   && <SchedulePage />}
            {tab === 'users'      && <UsersPage currentUser={{ ...authState.user, is_admin: authState.is_admin }} />}
          </main>
        </div>
      </div>
    </AppProviders>
  )
}
