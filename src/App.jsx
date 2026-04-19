import { useState } from 'react'
import { AppProviders } from './contexts/AppProviders.jsx'
import CoursesPage       from './pages/CoursesPage.jsx'
import StudentsPage      from './pages/StudentsPage.jsx'
import TeachersPage      from './pages/TeachersPage.jsx'
import LessonRecordsPage from './pages/LessonRecordsPage.jsx'
import SettlementPage    from './pages/SettlementPage.jsx'
import MaterialsPage     from './pages/MaterialsPage.jsx'

const TABS = [
  { id: 'lessons',    label: '上課紀錄' },
  { id: 'settlement', label: '結算'     },
  { id: 'students',   label: '學生'     },
  { id: 'teachers',   label: '老師'     },
  { id: 'courses',    label: '課程'     },
  { id: 'materials',  label: '教材'     },
]

function AppShell() {
  const [tab, setTab] = useState('lessons')

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
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  )
}
