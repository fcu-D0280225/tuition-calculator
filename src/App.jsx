import { useState } from 'react'
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

const NAV = [
  { type: 'tab', id: 'dashboard', label: '財務總覽' },
  { type: 'group', key: 'courses', label: '課程', children: [
    { id: 'courses', label: '家教課' },
    { id: 'groups',  label: '團課' },
  ]},
  { type: 'group', key: 'records', label: '紀錄', children: [
    { id: 'lessons',    label: '上課紀錄' },
    { id: 'attendance', label: '點名' },
    { id: 'materials',  label: '教材' },
  ]},
  { type: 'tab', id: 'settlement', label: '結算' },
  { type: 'group', key: 'people', label: '人員', children: [
    { id: 'students', label: '學生' },
    { id: 'teachers', label: '老師' },
  ]},
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function navigate(id) {
    setTab(id)
    setSidebarOpen(false)
  }

  return (
    <AppProviders>
      <div className="app-shell">
        {/* 手機遮罩：點擊關閉 drawer */}
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
            {NAV.map(item => item.type === 'group' ? (
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
          </nav>
        </aside>

        <div className="app-content">
          {/* 手機頂部 bar */}
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
          </main>
        </div>
      </div>
    </AppProviders>
  )
}
