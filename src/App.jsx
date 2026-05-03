import { useEffect, useMemo, useState } from 'react'
import { AppProviders } from './contexts/AppProviders.jsx'
import CoursesPage       from './pages/CoursesPage.jsx'
import StudentsPage      from './pages/StudentsPage.jsx'
import StudentEnrollPage from './pages/StudentEnrollPage.jsx'
import TeachersPage      from './pages/TeachersPage.jsx'
import TutoringLessonsPage from './pages/TutoringLessonsPage.jsx'
import GroupLessonsPage    from './pages/GroupLessonsPage.jsx'
import SettlementPage    from './pages/SettlementPage.jsx'
import TuitionSettlementPage from './pages/TuitionSettlementPage.jsx'
import SalarySettlementPage  from './pages/SalarySettlementPage.jsx'
import ProfitLossPage        from './pages/ProfitLossPage.jsx'
import MiscPage              from './pages/MiscPage.jsx'
import MaterialsPage     from './pages/MaterialsPage.jsx'
import GroupsPage        from './pages/GroupsPage.jsx'
import DashboardPage     from './pages/DashboardPage.jsx'
import AttendancePage    from './pages/AttendancePage.jsx'
import SchedulePage      from './pages/SchedulePage.jsx'
import UsersPage         from './pages/UsersPage.jsx'
import LoginPage         from './pages/LoginPage.jsx'
import { apiAuthMe, apiAuthLogout } from './data/api.js'

const NAV = [
  { type: 'group', key: 'courses', label: '課程', children: [
    { id: 'courses', label: '家教課' },
    { id: 'groups',  label: '團課' },
  ]},
  { type: 'group', key: 'people', label: '人員', children: [
    { id: 'students', label: '學生' },
    { id: 'teachers', label: '老師' },
  ]},
  { type: 'group', key: 'lessons', label: '上課紀錄', children: [
    { id: 'lessons_tutoring', label: '家教課上課紀錄' },
    { id: 'lessons_group',    label: '團課上課紀錄' },
  ]},
  { type: 'group', key: 'records', label: '紀錄', children: [
    { id: 'attendance', label: '點名' },
    { id: 'materials',  label: '教材' },
    { id: 'misc',       label: '雜項支出' },
  ]},
  { type: 'tab', id: 'schedule', label: '課表' },
  { type: 'group', key: 'settlement', label: '結算', children: [
    { id: 'settlement_tuition', label: '學費結算' },
    { id: 'settlement_salary',  label: '老師薪資結算' },
    { id: 'settlement',         label: '結算總覽' },
    { id: 'profit_loss',        label: '損益報表' },
  ]},
  { type: 'group', key: 'admin', label: '管理', children: [
    { id: 'dashboard', label: '財務總覽' },
    { id: 'users',     label: '使用者管理' },
  ]},
]

function filterNav(perms, isAdmin) {
  const has = id => {
    if (isAdmin) return true
    if (perms.includes(id)) return true
    // 舊 'lessons' 權限視同包含拆分後的兩個頁
    if ((id === 'lessons_tutoring' || id === 'lessons_group') && perms.includes('lessons')) return true
    // 舊 'settlement' 權限視同含三個結算子頁
    if ((id === 'settlement_tuition' || id === 'settlement_salary' || id === 'profit_loss') && perms.includes('settlement')) return true
    if (id === 'users' && isAdmin) return true
    return false
  }
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
  const [enrollContext, setEnrollContext] = useState(null) // { studentId, studentName }
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authState, setAuthState] = useState({ status: 'loading', user: null, is_admin: false, permissions: [] })
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const raw = localStorage.getItem('nav_collapsed_groups')
      return new Set(raw ? JSON.parse(raw) : [])
    } catch { return new Set() }
  })
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('app_theme')
      if (saved === 'light' || saved === 'dark') return saved
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch { return 'light' }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('app_theme', theme) } catch {}
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  function toggleGroup(key) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      try { localStorage.setItem('nav_collapsed_groups', JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

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
    if (tab === 'student_enroll') return // 內部跳轉用，不在 NAV 中
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
    setEnrollContext(null)
    setSidebarOpen(false)
  }

  function openStudentEnroll(student) {
    setEnrollContext({ studentId: student.id, studentName: student.name })
    setTab('student_enroll')
    setSidebarOpen(false)
  }

  function closeStudentEnroll() {
    setEnrollContext(null)
    setTab('students')
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
            {visibleNav.map(item => {
              if (item.type !== 'group') {
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-tab ${tab === item.id ? 'active' : ''}`}
                    onClick={() => navigate(item.id)}
                  >
                    {item.label}
                  </button>
                )
              }
              const collapsed = collapsedGroups.has(item.key)
              return (
                <div className={`nav-section${collapsed ? ' collapsed' : ''}`} key={item.key}>
                  <button
                    type="button"
                    className="nav-section-label nav-section-toggle"
                    onClick={() => toggleGroup(item.key)}
                    aria-expanded={!collapsed}
                  >
                    <span className="nav-section-chev" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
                    <span>{item.label}</span>
                  </button>
                  {!collapsed && item.children.map(c => (
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
              )
            })}
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
          <header className="app-topbar">
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
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? '切換到日間模式' : '切換到夜間模式'}
              title={theme === 'dark' ? '切換到日間模式' : '切換到夜間模式'}
            >
              {theme === 'dark' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </header>

          <main className="app-main">
            {tab === 'dashboard'  && <DashboardPage />}
            {tab === 'lessons_tutoring' && <TutoringLessonsPage />}
            {tab === 'lessons_group'    && <GroupLessonsPage />}
            {tab === 'settlement'         && <SettlementPage />}
            {tab === 'settlement_tuition' && <TuitionSettlementPage />}
            {tab === 'settlement_salary'  && <SalarySettlementPage />}
            {tab === 'profit_loss'        && <ProfitLossPage />}
            {tab === 'misc'               && <MiscPage />}
            {tab === 'students'   && <StudentsPage onEnroll={openStudentEnroll} />}
            {tab === 'student_enroll' && enrollContext && (
              <StudentEnrollPage
                studentId={enrollContext.studentId}
                studentName={enrollContext.studentName}
                onBack={closeStudentEnroll}
              />
            )}
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
