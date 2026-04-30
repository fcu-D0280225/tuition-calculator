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

  return (
    <AppProviders>
      <div className="app-shell">
        <aside className="app-sidebar">
          <div className="app-title">補習班管理系統</div>
          <nav className="app-nav">
            {NAV.map(item => item.type === 'group' ? (
              <div className="nav-section" key={item.key}>
                <div className="nav-section-label">{item.label}</div>
                {item.children.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className={`nav-tab ${tab === c.id ? 'active' : ''}`}
                    onClick={() => setTab(c.id)}
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
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="app-main">
          {tab === 'dashboard'  && <DashboardPage />}
          {tab === 'lessons'    && <LessonRecordsPage />}
          {tab === 'settlement' && <SettlementPage />}
          {tab === 'students'   && <StudentsPage />}
          {tab === 'teachers'   && <TeachersPage />}
          {tab === 'courses'    && <CoursesPage />}
          {tab === 'materials'   && <MaterialsPage />}
          {tab === 'groups'      && <GroupsPage />}
          {tab === 'attendance'  && <AttendancePage />}
        </main>
      </div>
    </AppProviders>
  )
}
