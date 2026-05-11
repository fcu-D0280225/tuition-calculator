import { useEffect, useMemo, useState } from 'react'
import { AppProviders } from './contexts/AppProviders.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import CoursesPage       from './pages/CoursesPage.jsx'
import CourseDetailPage  from './pages/CourseDetailPage.jsx'
import StudentsPage      from './pages/StudentsPage.jsx'
import StudentEnrollPage from './pages/StudentEnrollPage.jsx'
import TeachersPage      from './pages/TeachersPage.jsx'
import TutoringLessonsPage from './pages/TutoringLessonsPage.jsx'
import GroupLessonsPage    from './pages/GroupLessonsPage.jsx'
import SettlementPage    from './pages/SettlementPage.jsx'
import TuitionSettlementPage from './pages/TuitionSettlementPage.jsx'
import SalarySettlementPage  from './pages/SalarySettlementPage.jsx'
import MiscPage              from './pages/MiscPage.jsx'
import MaterialsPage     from './pages/MaterialsPage.jsx'
import GroupsPage        from './pages/GroupsPage.jsx'
import DashboardPage     from './pages/DashboardPage.jsx'
import AttendancePage    from './pages/AttendancePage.jsx'
import SchedulePage      from './pages/SchedulePage.jsx'
import UsersPage         from './pages/UsersPage.jsx'
import AiAssistantPage   from './pages/AiAssistantPage.jsx'
import LoginPage         from './pages/LoginPage.jsx'
import { apiAuthMe, apiAuthLogout } from './data/api.js'

const NAV_ICONS = {
  courses:            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  groups:             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  students:           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  teachers:           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  lessons_tutoring:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  lessons_group:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  attendance:         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  materials:          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  misc:               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  schedule:           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/></svg>,
  settlement_tuition: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  settlement_salary:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  settlement:         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  dashboard:          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  ai_assistant:       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  users:              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>,
}

const GROUP_ICONS = {
  courses:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  people:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  lessons:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  records:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  settlement: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  admin:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
}

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
  ]},
  { type: 'group', key: 'admin', label: '管理', children: [
    { id: 'dashboard',     label: '財務總覽' },
    { id: 'ai_assistant',  label: 'AI 助理' },
    { id: 'users',         label: '使用者管理' },
  ]},
]

function filterNav(perms, isAdmin) {
  const has = id => {
    if (isAdmin) return true
    if (perms.includes(id)) return true
    // 舊 'lessons' 權限視同包含拆分後的兩個頁
    if ((id === 'lessons_tutoring' || id === 'lessons_group') && perms.includes('lessons')) return true
    // 舊 'settlement' 權限視同含三個結算子頁
    if ((id === 'settlement_tuition' || id === 'settlement_salary') && perms.includes('settlement')) return true
    // 損益報表已併入「財務總覽」：給 profit_loss 權限的人，自動視為有 dashboard 權限
    if (id === 'dashboard' && perms.includes('profit_loss')) return true
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

function firstAllowedTab(visibleNav, preferId = null) {
  if (preferId) {
    for (const item of visibleNav) {
      if (item.type === 'tab' && item.id === preferId) return item.id
      if (item.children?.some(c => c.id === preferId)) return preferId
    }
  }
  for (const item of visibleNav) {
    if (item.type === 'tab') return item.id
    if (item.children?.length) return item.children[0].id
  }
  return null
}

export default function App() {
  const [tab, setTab] = useState(null)
  const [enrollContext, setEnrollContext] = useState(null) // { studentId, studentName }
  const [courseEditId, setCourseEditId] = useState(null)
  const [attendanceContext, setAttendanceContext] = useState(null) // { mode, id, date }
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authState, setAuthState] = useState({ status: 'loading', user: null, is_admin: false, permissions: [], teacher_id: null })
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

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

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
      .then(({ user, is_admin, permissions, teacher_id }) => {
        if (!cancelled) setAuthState({ status: 'authed', user, is_admin: !!is_admin, permissions: permissions || [], teacher_id: teacher_id || null })
      })
      .catch(() => { if (!cancelled) setAuthState({ status: 'guest', user: null, is_admin: false, permissions: [], teacher_id: null }) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function onUnauthorized() {
      setAuthState({ status: 'guest', user: null, is_admin: false, permissions: [], teacher_id: null })
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
    if (tab === 'course_edit') return // 內部跳轉用，不在 NAV 中
    if (!tab || !allowedTabIds.has(tab)) {
      // 老師帳號（綁定 teacher_id 且非管理員）優先導向點名
      const prefer = (!authState.is_admin && authState.teacher_id) ? 'attendance' : null
      setTab(firstAllowedTab(visibleNav, prefer))
    }
  }, [authState.status, authState.is_admin, authState.teacher_id, allowedTabIds, visibleNav, tab])

  async function handleLogout() {
    try { await apiAuthLogout() } catch { /* ignore */ }
    setAuthState({ status: 'guest', user: null, is_admin: false, permissions: [] })
    setTab(null)
    setSidebarOpen(false)
  }

  function navigate(id) {
    setTab(id)
    setEnrollContext(null)
    if (id !== 'attendance') setAttendanceContext(null)
    setSidebarOpen(false)
  }

  function openAttendance(ctx) {
    setAttendanceContext(ctx)
    setTab('attendance')
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

  function openCourseEdit(course) {
    setCourseEditId(course.id)
    setTab('course_edit')
    setSidebarOpen(false)
  }

  function closeCourseEdit() {
    setCourseEditId(null)
    setTab('courses')
  }

  if (authState.status === 'loading') {
    return <div className="login-shell"><div className="login-loading">載入中…</div></div>
  }
  if (authState.status !== 'authed') {
    return <LoginPage onLoggedIn={({ user, is_admin, permissions, teacher_id }) => setAuthState({ status: 'authed', user, is_admin: !!is_admin, permissions: permissions || [], teacher_id: teacher_id || null })} />
  }

  return (
    <AuthProvider value={{
      user: authState.user,
      is_admin: authState.is_admin,
      permissions: authState.permissions,
      teacher_id: authState.teacher_id,
    }}>
    <AppProviders>
      <div className="app-shell">
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={`app-sidebar${sidebarOpen ? ' open' : ''}`}>
          <div className="app-sidebar-header">
            <div className="app-logo">
              <div className="app-logo-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              </div>
              <div className="app-logo-text">
                <div className="app-title">補習班管理</div>
                <div className="app-subtitle">TUTORING MANAGEMENT</div>
              </div>
            </div>
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
                    <span className="nav-tab-icon">{NAV_ICONS[item.id]}</span>
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
                    <span className="nav-section-icon">{GROUP_ICONS[item.key]}</span>
                    <span className="nav-section-text">{item.label}</span>
                    <span className="nav-section-chev" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
                  </button>
                  {!collapsed && item.children.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className={`nav-tab nav-tab--child ${tab === c.id ? 'active' : ''}`}
                      onClick={() => navigate(c.id)}
                    >
                      <span className="nav-tab-icon">{NAV_ICONS[c.id]}</span>
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
            <div className="app-sidebar-user">
              <div className="app-sidebar-avatar">{authState.user?.username?.charAt(0)?.toUpperCase() || 'U'}</div>
              <div className="app-sidebar-user-info">
                <div className="app-sidebar-username">
                  {authState.user?.username}
                  {authState.is_admin && <span className="users-self-tag"> ·管理員</span>}
                </div>
              </div>
            </div>
            <button type="button" className="logout-btn" onClick={handleLogout}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              登出
            </button>
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
            <span className="mobile-topbar-title">補習班管理</span>

            <div className="topbar-actions">
              <button
                type="button"
                className="topbar-icon-btn"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? '切換到日間模式' : '切換到夜間模式'}
                title={theme === 'dark' ? '切換到日間模式' : '切換到夜間模式'}
              >
                {theme === 'dark' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              <div className="topbar-user">
                <div className="topbar-avatar">{authState.user?.username?.charAt(0)?.toUpperCase() || 'U'}</div>
                <div className="topbar-user-info">
                  <div className="topbar-user-name">{authState.user?.username || '使用者'}</div>
                  <div className="topbar-user-role">{authState.is_admin ? 'Super Administrator' : '教師帳號'}</div>
                </div>
              </div>
            </div>
          </header>

          <main className="app-main">
            {tab === 'dashboard'  && <DashboardPage />}
            {tab === 'lessons_tutoring' && <TutoringLessonsPage />}
            {tab === 'lessons_group'    && <GroupLessonsPage />}
            {tab === 'settlement'         && <SettlementPage />}
            {tab === 'settlement_tuition' && <TuitionSettlementPage />}
            {tab === 'settlement_salary'  && <SalarySettlementPage />}
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
            {tab === 'courses'    && <CoursesPage onEditCourse={openCourseEdit} />}
            {tab === 'course_edit' && courseEditId && (
              <CourseDetailPage courseId={courseEditId} onBack={closeCourseEdit} />
            )}
            {tab === 'materials'  && <MaterialsPage />}
            {tab === 'groups'     && <GroupsPage />}
            {tab === 'attendance' && <AttendancePage initialContext={attendanceContext} />}
            {tab === 'schedule'   && <SchedulePage onOpenAttendance={allowedTabIds.has('attendance') ? openAttendance : null} />}
            {tab === 'ai_assistant' && <AiAssistantPage />}
            {tab === 'users'      && <UsersPage currentUser={{ ...authState.user, is_admin: authState.is_admin }} />}
          </main>
        </div>
      </div>
    </AppProviders>
    </AuthProvider>
  )
}
