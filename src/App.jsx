import { useEffect, useRef, useState } from 'react'
import { AppProviders } from './contexts/AppProviders.jsx'
import CoursesPage       from './pages/CoursesPage.jsx'
import StudentsPage      from './pages/StudentsPage.jsx'
import TeachersPage      from './pages/TeachersPage.jsx'
import LessonRecordsPage from './pages/LessonRecordsPage.jsx'
import SettlementPage    from './pages/SettlementPage.jsx'
import MaterialsPage     from './pages/MaterialsPage.jsx'
import GroupsPage        from './pages/GroupsPage.jsx'
import DashboardPage     from './pages/DashboardPage.jsx'

const NAV = [
  { type: 'tab', id: 'dashboard', label: '財務總覽' },
  { type: 'group', key: 'courses', label: '課程', children: [
    { id: 'courses', label: '家教課' },
    { id: 'groups',  label: '團課' },
  ]},
  { type: 'group', key: 'records', label: '紀錄', children: [
    { id: 'lessons',   label: '上課紀錄' },
    { id: 'materials', label: '教材' },
  ]},
  { type: 'tab', id: 'settlement', label: '結算' },
  { type: 'group', key: 'people', label: '人員', children: [
    { id: 'students', label: '學生' },
    { id: 'teachers', label: '老師' },
  ]},
]

function NavGroup({ label, children, currentTab, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const activeChild = children.find(c => c.id === currentTab)

  useEffect(() => {
    if (!open) return
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="nav-group" ref={ref}>
      <button
        type="button"
        className={`nav-tab ${activeChild ? 'active' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        {label} ▾
      </button>
      {open && (
        <div className="nav-group-menu">
          {children.map(c => (
            <button
              key={c.id}
              type="button"
              className={`nav-group-item ${currentTab === c.id ? 'active' : ''}`}
              onClick={() => { onSelect(c.id); setOpen(false) }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('dashboard')

  return (
    <AppProviders>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-title">補習班管理系統</div>
          <nav className="app-nav">
            {NAV.map(item => item.type === 'group' ? (
              <NavGroup
                key={item.key}
                label={item.label}
                children={item.children}
                currentTab={tab}
                onSelect={setTab}
              />
            ) : (
              <button
                key={item.id}
                className={`nav-tab ${tab === item.id ? 'active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
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
        </main>
      </div>
    </AppProviders>
  )
}
