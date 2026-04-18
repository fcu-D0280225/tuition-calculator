import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createEmptyCourse } from './data/students'
import {
  loadCourseCatalog,
  saveCourseCatalog,
  studentCourseFromCatalogItem,
} from './data/courseCatalog'
import {
  DEFAULT_UNIT_PRICES,
  computeCourseSubtotal,
} from './data/pricingDefaults'
import {
  loadMonthProjectsState,
  saveMonthProjectsState,
  initialProjectsBootstrap,
  createNewMonthProject,
  defaultPeriodLabel,
} from './data/monthProjects'
import { buildMonthlyBundleData } from './utils/monthBundle'
import { generateMonthlyBundlePDF } from './utils/pdf'
import StudentList from './components/StudentList'
import StudentDetail from './components/StudentDetail'
import CourseCatalogPage from './components/CourseCatalogPage'
import MonthProjectBar from './components/MonthProjectBar'
import StudentRosterPage from './components/StudentRosterPage'
import { attachDisplayNames } from './data/studentRoster'
import {
  apiListStudents,
  apiCreateStudent,
  apiRenameStudent,
  apiDeleteStudent,
} from './data/api'
import './index.css'

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function sumHourFields(c) {
  return (
    (Number(c.ind1) || 0) +
    (Number(c.ind2) || 0) +
    (Number(c.grp34) || 0) +
    (Number(c.ind_special) || 0) +
    (Number(c.ind_other) || 0)
  )
}

export default function App() {
  const [mainView, setMainView] = useState('students')
  const [courseCatalog, setCourseCatalog] = useState([])
  const [projects, setProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [studentRoster, setStudentRoster] = useState([])
  const [loadingState, setLoadingState] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState(null)

  const hasHydratedRef = useRef(false)

  const refreshAll = useCallback(async () => {
    setLoadingState('loading')
    setLoadError(null)
    try {
      const [roster, mp, catalog] = await Promise.all([
        apiListStudents(),
        loadMonthProjectsState(),
        loadCourseCatalog(),
      ])
      setStudentRoster(Array.isArray(roster) ? roster : [])
      setCourseCatalog(Array.isArray(catalog) ? catalog : [])
      const normalized = mp || initialProjectsBootstrap()
      setProjects(normalized.projects)
      setActiveProjectId(normalized.activeProjectId)
      hasHydratedRef.current = true
      setLoadingState('ready')
    } catch (e) {
      console.error('refreshAll', e)
      setLoadError(e?.message || '無法連線後端')
      setLoadingState('error')
    }
  }, [])

  const refreshRoster = useCallback(async () => {
    try {
      const list = await apiListStudents()
      setStudentRoster(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error('refreshRoster', e)
      window.alert('重新載入學生名冊失敗')
    }
  }, [])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  const [selectedRosterId, setSelectedRosterId] = useState(null)
  const [search, setSearch] = useState('')
  const [newStudentName, setNewStudentName] = useState('')

  /**
   * 學生與收費：先「專案設定」（建立／選擇專案），再「工作區」（學生 → 課程）
   * 切換作用中專案時回到專案設定，避免未意識到期別就編學生。
   */
  const [billingPhase, setBillingPhase] = useState('setup')

  const activeProject = useMemo(
    () => projects.find(p => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  )

  const students = activeProject?.students ?? []
  const unitDefaults = activeProject?.unitDefaults ?? DEFAULT_UNIT_PRICES
  const period = activeProject?.label ?? ''

  const studentsForUI = useMemo(
    () => attachDisplayNames(students, studentRoster),
    [students, studentRoster]
  )

  const filtered = useMemo(
    () => studentsForUI.filter(s => s.name.includes(search)),
    [studentsForUI, search]
  )

  const rosterIdsInProject = useMemo(
    () => new Set(students.map(s => s.rosterId)),
    [students]
  )

  /** 名冊中尚未納入本專案者，與上方搜尋共用關鍵字（可逐筆加入本專案） */
  const rosterAddCandidates = useMemo(() => {
    const q = search.trim()
    return studentRoster
      .filter(r => r && typeof r.id === 'string' && !rosterIdsInProject.has(r.id))
      .filter(r => !q || (typeof r.name === 'string' && r.name.includes(q)))
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hant'))
  }, [studentRoster, rosterIdsInProject, search])

  const selected = useMemo(
    () => studentsForUI.find(s => s.rosterId === selectedRosterId) ?? null,
    [studentsForUI, selectedRosterId]
  )

  const monthlyBundle = useMemo(
    () => buildMonthlyBundleData(studentsForUI, unitDefaults),
    [studentsForUI, unitDefaults]
  )

  const [bundleLoading, setBundleLoading] = useState(false)

  useEffect(() => {
    if (!hasHydratedRef.current) return
    const t = setTimeout(() => {
      saveCourseCatalog(courseCatalog).catch(e => console.error('saveCourseCatalog', e))
    }, 400)
    return () => clearTimeout(t)
  }, [courseCatalog])

  useEffect(() => {
    if (!hasHydratedRef.current) return
    if (!activeProjectId) return
    const t = setTimeout(() => {
      saveMonthProjectsState({ projects, activeProjectId }).catch(e =>
        console.error('saveMonthProjectsState', e)
      )
    }, 400)
    return () => clearTimeout(t)
  }, [projects, activeProjectId])

  useEffect(() => {
    if (projects.length === 0) return
    if (!projects.some(p => p.id === activeProjectId)) {
      setActiveProjectId(projects[0].id)
    }
  }, [projects, activeProjectId])

  useEffect(() => {
    if (!activeProject || selectedRosterId == null) return
    if (!activeProject.students.some(s => s.rosterId === selectedRosterId)) {
      setSelectedRosterId(null)
    }
  }, [activeProject, activeProjectId, selectedRosterId])

  useEffect(() => {
    setBillingPhase('setup')
  }, [activeProjectId])

  function mapActiveProject(mutator) {
    setProjects(prev =>
      prev.map(p => {
        if (p.id !== activeProjectId) return p
        return mutator(p)
      })
    )
  }

  function handleSwitchProject(id) {
    setActiveProjectId(id)
  }

  function handleRenameProject(id, label) {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, label } : p)))
  }

  function handleCreateProjectFromRoster({ label, rosterIds }) {
    const ud = { ...DEFAULT_UNIT_PRICES }
    const rows = rosterIds.map(rid => {
      const c = createEmptyCourse()
      c.subtotal = computeCourseSubtotal(c, ud)
      return { rosterId: rid, courses: [c] }
    })
    const p = createNewMonthProject({
      label: (label && String(label).trim()) || defaultPeriodLabel(),
      students: rows,
      unitDefaults: ud,
    })
    setProjects(prev => [...prev, p])
    setActiveProjectId(p.id)
    setSelectedRosterId(null)
    setBillingPhase('setup')
  }

  function handleAddRosterToActiveProject(rosterId) {
    if (!activeProjectId) return
    if (students.some(s => s.rosterId === rosterId)) {
      window.alert('此學生已在目前專案中。')
      return
    }
    if (!studentRoster.some(r => r.id === rosterId)) {
      window.alert('名冊中找不到此學生。')
      return
    }
    const c = createEmptyCourse()
    c.subtotal = computeCourseSubtotal(c, unitDefaults)
    mapActiveProject(p => ({
      ...p,
      students: [...p.students, { rosterId, courses: [c] }],
    }))
    setSelectedRosterId(rosterId)
  }

  /** 將指定專案的學生與預設單價複製到新專案（與「複製目前專案」相同邏輯，但可選來源） */
  function handleImportProjectToNew(sourceProjectId, newLabel) {
    const src = projects.find(p => p.id === sourceProjectId)
    if (!src) {
      window.alert('找不到來源專案，請重新選擇。')
      return
    }
    const label = (newLabel && String(newLabel).trim()) || defaultPeriodLabel()
    const p = createNewMonthProject({
      label,
      students: deepClone(src.students),
      unitDefaults: { ...src.unitDefaults },
    })
    setProjects(prev => [...prev, p])
    setActiveProjectId(p.id)
    setSelectedRosterId(null)
    setBillingPhase('setup')
  }

  function handleDuplicateProject(label) {
    handleImportProjectToNew(activeProjectId, label)
  }

  function handleDeleteProject(id) {
    setProjects(prev => {
      const next = prev.filter(p => p.id !== id)
      if (next.length === prev.length || next.length === 0) return prev
      return next
    })
  }

  async function handleMonthlyBundlePdf() {
    setBundleLoading(true)
    try {
      await generateMonthlyBundlePDF(
        period,
        monthlyBundle.summaryRows,
        monthlyBundle.grandTotal,
        monthlyBundle.details
      )
    } catch (err) {
      console.error(err)
      window.alert('產生全班 PDF 失敗，請重試或改為逐張下載單人學費單。若剛複製專案，請確認已執行 npm install。')
    } finally {
      setBundleLoading(false)
    }
  }

  function updateCourse(rosterId, courseIdx, field, value) {
    mapActiveProject(p => {
      const ud = p.unitDefaults
      return {
        ...p,
        students: p.students.map(s => {
          if (s.rosterId !== rosterId) return s
          const courses = s.courses.map((c, i) => {
            if (i !== courseIdx) return c
            const updated = { ...c }
            const priceFields = new Set([
              'price_ind1', 'price_ind2', 'price_grp34', 'price_ind_special', 'price_ind_other',
            ])
            if (priceFields.has(field) && (value === null || value === '')) {
              delete updated[field]
            } else {
              const num = typeof value === 'number' ? value : parseFloat(value)
              updated[field] = Number.isFinite(num) ? num : 0
            }
            updated.hours = sumHourFields(updated)
            updated.subtotal = computeCourseSubtotal(updated, ud)
            return updated
          })
          return { ...s, courses }
        }),
      }
    })
  }

  function patchCourse(rosterId, courseIdx, patch) {
    mapActiveProject(p => {
      const ud = p.unitDefaults
      return {
        ...p,
        students: p.students.map(s => {
          if (s.rosterId !== rosterId) return s
          const courses = s.courses.map((c, i) => {
            if (i !== courseIdx) return c
            const merged = { ...c, ...patch }
            merged.hours = sumHourFields(merged)
            merged.subtotal = computeCourseSubtotal(merged, ud)
            return merged
          })
          return { ...s, courses }
        }),
      }
    })
  }

  function setAllInvoiceInclude(rosterId, include) {
    mapActiveProject(p => ({
      ...p,
      students: p.students.map(s => {
        if (s.rosterId !== rosterId) return s
        return {
          ...s,
          courses: s.courses.map(c => ({ ...c, invoice_include: include })),
        }
      }),
    }))
  }

  function setUnitDefaultField(key, raw) {
    const num = parseFloat(raw)
    mapActiveProject(p => {
      const next = {
        ...p.unitDefaults,
        [key]: Number.isFinite(num) ? num : 0,
      }
      return {
        ...p,
        unitDefaults: next,
        students: p.students.map(s => ({
          ...s,
          courses: s.courses.map(c => ({
            ...c,
            subtotal: computeCourseSubtotal(c, next),
          })),
        })),
      }
    })
  }

  async function addStudent(rawName) {
    const name = rawName.trim()
    if (!name) {
      window.alert('請輸入學生姓名')
      return
    }
    const dup = students.some(s => {
      const r = studentRoster.find(x => x.id === s.rosterId)
      return r?.name === name
    })
    if (dup) {
      window.alert('本專案已有相同姓名的學生')
      return
    }
    let created
    try {
      created = await apiCreateStudent(name)
    } catch (e) {
      console.error('addStudent', e)
      window.alert('新增學生失敗，請確認後端連線')
      return
    }
    const c = createEmptyCourse()
    c.subtotal = computeCourseSubtotal(c, unitDefaults)
    setStudentRoster(prev => [...prev, created])
    mapActiveProject(p => ({
      ...p,
      students: [...p.students, { rosterId: created.id, courses: [c] }],
    }))
    setSelectedRosterId(created.id)
    setNewStudentName('')
    setSearch('')
  }

  async function renameRosterEntry(id, name) {
    try {
      const updated = await apiRenameStudent(id, name)
      setStudentRoster(prev => prev.map(r => (r.id === id ? updated : r)))
    } catch (e) {
      console.error('renameRosterEntry', e)
      window.alert('改名失敗，請確認後端連線')
    }
  }

  async function deleteRosterEntry(id) {
    try {
      await apiDeleteStudent(id)
      setStudentRoster(prev => prev.filter(r => r.id !== id))
    } catch (e) {
      console.error('deleteRosterEntry', e)
      window.alert('刪除失敗，請確認後端連線')
    }
  }

  async function addRosterOnly(name) {
    try {
      const created = await apiCreateStudent(name)
      setStudentRoster(prev => [...prev, created])
      return created
    } catch (e) {
      console.error('addRosterOnly', e)
      window.alert('新增名冊失敗，請確認後端連線')
      return null
    }
  }

  function addCourse(rosterId) {
    mapActiveProject(p => {
      const ud = p.unitDefaults
      return {
        ...p,
        students: p.students.map(s => {
          if (s.rosterId !== rosterId) return s
          const next = createEmptyCourse()
          next.subtotal = computeCourseSubtotal(next, ud)
          return { ...s, courses: [...s.courses, next] }
        }),
      }
    })
  }

  function addCourseFromCatalog(rosterId, catalogItem) {
    mapActiveProject(p => {
      const ud = p.unitDefaults
      const row = studentCourseFromCatalogItem(catalogItem, ud)
      return {
        ...p,
        students: p.students.map(s => {
          if (s.rosterId !== rosterId) return s
          return { ...s, courses: [...s.courses, row] }
        }),
      }
    })
  }

  function removeCourse(rosterId, courseIdx) {
    mapActiveProject(p => ({
      ...p,
      students: p.students.map(s => {
        if (s.rosterId !== rosterId) return s
        if (s.courses.length <= 1) {
          window.alert('至少需要保留一門課程')
          return s
        }
        const courses = s.courses.filter((_, i) => i !== courseIdx)
        return { ...s, courses }
      }),
    }))
  }

  function removeStudentFromProject(rosterId) {
    const rosterEntry = studentRoster.find(r => r.id === rosterId)
    const displayName = rosterEntry?.name ?? '此學生'
    if (
      !window.confirm(
        `確定將「${displayName}」從本專案移除？課程資料將一併刪除，但該生仍保留在學生名冊中。`
      )
    ) {
      return
    }
    mapActiveProject(p => ({
      ...p,
      students: p.students.filter(s => s.rosterId !== rosterId),
    }))
    setSelectedRosterId(null)
  }

  if (loadingState === 'loading') {
    return (
      <div className="app app--loading">
        <p className="app-loading-text">載入中…</p>
      </div>
    )
  }

  if (loadingState === 'error') {
    return (
      <div className="app app--loading">
        <p className="app-loading-text">載入失敗：{loadError}</p>
        <button type="button" className="app-loading-retry" onClick={refreshAll}>
          重試
        </button>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-top-nav" role="navigation">
        <button
          type="button"
          className={`app-nav-btn ${mainView === 'students' ? 'is-active' : ''}`}
          onClick={() => setMainView('students')}
        >
          學生與收費
        </button>
        <button
          type="button"
          className={`app-nav-btn ${mainView === 'roster' ? 'is-active' : ''}`}
          onClick={() => setMainView('roster')}
        >
          學生名冊
        </button>
        <button
          type="button"
          className={`app-nav-btn ${mainView === 'catalog' ? 'is-active' : ''}`}
          onClick={() => setMainView('catalog')}
        >
          課程庫
        </button>
      </header>

      {mainView === 'catalog' ? (
        <main className="main main--catalog">
          <CourseCatalogPage items={courseCatalog} onChangeItems={setCourseCatalog} />
        </main>
      ) : mainView === 'roster' ? (
        <main className="main main--roster">
          <StudentRosterPage
            roster={studentRoster}
            loading={loadingState === 'loading'}
            error={loadingState === 'error' ? loadError : null}
            onRenameRoster={renameRosterEntry}
            onDeleteRoster={deleteRosterEntry}
            onAddRoster={addRosterOnly}
            onRetry={refreshAll}
            projects={projects}
            activeProjectId={activeProjectId}
            onAddRosterToActiveProject={handleAddRosterToActiveProject}
          />
        </main>
      ) : billingPhase === 'setup' ? (
        <div className="billing-setup">
          <header className="billing-setup-hero" aria-labelledby="billing-project-title">
            <p className="billing-setup-eyebrow">學生與收費 · 第一步</p>
            <h1 id="billing-project-title" className="billing-setup-title">
              {activeProject?.label?.trim() ? activeProject.label : '請建立或選擇收費專案'}
            </h1>
            <p className="billing-setup-desc">
              此頁以<strong>專案（期別）</strong>為單位：請先在此建立新專案、從名冊帶入學生，或從下方選取既有專案並確認期別。完成後再進入第二步，將學生納入名單，並於第三步為各學生加入課程。
            </p>
          </header>
          <MonthProjectBar
            projects={projects}
            activeProjectId={activeProjectId}
            studentRoster={studentRoster}
            onSwitchProject={handleSwitchProject}
            onRenameProject={handleRenameProject}
            onCreateProjectFromRoster={handleCreateProjectFromRoster}
            onDuplicateProject={handleDuplicateProject}
            onImportProjectToNew={handleImportProjectToNew}
            onDeleteProject={handleDeleteProject}
          />
          <div className="billing-setup-actions">
            <button
              type="button"
              className="btn-billing-enter"
              disabled={!activeProject}
              onClick={() => setBillingPhase('workspace')}
            >
              進入本專案：管理學生與收費
            </button>
            {!activeProject && (
              <p className="billing-setup-actions-hint">尚無可操作的專案時，請先用上方「建立新專案」或「匯入」。</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="billing-workspace-heading">
            <div className="billing-workspace-heading-text">
              <p className="billing-workspace-kicker">收費專案（第二步／第三步）</p>
              <h1 className="billing-workspace-title">{period || '未命名專案'}</h1>
              <p className="billing-workspace-steps">
                <span className="billing-step billing-step--active">② 將學生加入本專案</span>
                <span className="billing-step-sep">→</span>
                <span className="billing-step">③ 點選左側學生以編輯課程與金額</span>
              </p>
            </div>
            <button
              type="button"
              className="btn-billing-back-setup"
              onClick={() => setBillingPhase('setup')}
            >
              ← 返回專案設定
            </button>
          </div>
          <div className="app-split">
            <aside className="sidebar">
              <div className="sidebar-header">
                <details className="sidebar-header-collapse" open>
                  <summary className="sidebar-header-collapse-summary">
                    <span className="sidebar-header-collapse-brand">② 本專案學生名單</span>
                    <span className="sidebar-header-collapse-meta">
                      {period || '—'} · {students.length} 人 · NT${' '}
                      {monthlyBundle.grandTotal.toLocaleString()}
                    </span>
                  </summary>
                  <div className="sidebar-header-collapse-body">
                    <div className="logo logo--compact">
                      <span className="logo-icon">📚</span>
                      <span className="logo-text">先加學生，再點人編課程</span>
                    </div>
                <details className="sidebar-collapse sidebar-collapse--bundle" open>
                  <summary className="sidebar-collapse-summary">
                    <span className="sidebar-collapse-title">整包 PDF / 全班合計</span>
                    <span className="sidebar-collapse-meta">
                      NT$ {monthlyBundle.grandTotal.toLocaleString()} · {students.length} 人 ·{' '}
                      {monthlyBundle.details.length} 筆明細
                    </span>
                  </summary>
                  <div className="sidebar-collapse-inner">
                    <div className="month-bundle-bar">
                      <div className="month-bundle-stat">
                        <span className="month-bundle-label">整月一包 · 本專案全班合計</span>
                        <strong className="month-bundle-total">
                          NT$ {monthlyBundle.grandTotal.toLocaleString()}
                        </strong>
                        <span className="month-bundle-meta">
                          {students.length} 人登錄 · {monthlyBundle.details.length} 人有可列印明細
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-bundle-pdf"
                        onClick={handleMonthlyBundlePdf}
                        disabled={bundleLoading}
                      >
                        {bundleLoading ? '⏳ 產生中…' : '📦 下載整月全班 PDF'}
                      </button>
                      <p className="month-bundle-hint">
                        PDF 標題與檔名使用上方「當月專案」的期別，與電腦日期無關。彙總表含每位學生已勾選科目之應繳金額。
                      </p>
                    </div>
                  </div>
                </details>
                <details className="defaults-panel sidebar-collapse">
                  <summary className="defaults-summary">預設每堂單價（本專案、未自訂時套用）</summary>
                  <div className="defaults-grid">
                    <label className="defaults-field">
                      <span>1人</span>
                      <input
                        type="number"
                        min="0"
                        value={unitDefaults.price_ind1}
                        onChange={e => setUnitDefaultField('price_ind1', e.target.value)}
                      />
                    </label>
                    <label className="defaults-field">
                      <span>2人</span>
                      <input
                        type="number"
                        min="0"
                        value={unitDefaults.price_ind2}
                        onChange={e => setUnitDefaultField('price_ind2', e.target.value)}
                      />
                    </label>
                    <label className="defaults-field">
                      <span>3–4人</span>
                      <input
                        type="number"
                        min="0"
                        value={unitDefaults.price_grp34}
                        onChange={e => setUnitDefaultField('price_grp34', e.target.value)}
                      />
                    </label>
                    <label className="defaults-field">
                      <span>特殊個人</span>
                      <input
                        type="number"
                        min="0"
                        value={unitDefaults.price_ind_special}
                        onChange={e => setUnitDefaultField('price_ind_special', e.target.value)}
                      />
                    </label>
                    <label className="defaults-field">
                      <span>其他個人</span>
                      <input
                        type="number"
                        min="0"
                        value={unitDefaults.price_ind_other}
                        onChange={e => setUnitDefaultField('price_ind_other', e.target.value)}
                      />
                    </label>
                  </div>
                </details>
                <details className="sidebar-collapse sidebar-collapse--search" open>
                  <summary className="sidebar-collapse-summary">
                    <span className="sidebar-collapse-title">搜尋與新增學生</span>
                    <span className="sidebar-collapse-meta">
                      本專案 {filtered.length} / {students.length} 位
                      {rosterAddCandidates.length > 0
                        ? ` · 名冊可加入 ${rosterAddCandidates.length}`
                        : ''}
                    </span>
                  </summary>
                  <div className="sidebar-collapse-inner">
                    <div className="search-wrap">
                      <span className="search-icon">🔍</span>
                      <input
                        className="search"
                        placeholder="搜尋本專案或名冊姓名…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                    <form
                      className="add-student-form"
                      onSubmit={e => {
                        e.preventDefault()
                        addStudent(newStudentName)
                      }}
                    >
                      <input
                        className="add-student-input"
                        placeholder="新學生姓名…"
                        value={newStudentName}
                        onChange={e => setNewStudentName(e.target.value)}
                        maxLength={32}
                      />
                      <button type="submit" className="btn-add-student">
                        ＋ 新增學生
                      </button>
                    </form>
                    <div className="count-badge">
                      本專案名單 {filtered.length} 位
                      {rosterAddCandidates.length > 0
                        ? ` · 名冊尚有 ${rosterAddCandidates.length} 人可加入`
                        : ''}
                    </div>
                  </div>
                </details>
                  </div>
                </details>
              </div>
              <StudentList
                students={filtered}
                selectedRosterId={selectedRosterId}
                onSelect={setSelectedRosterId}
                unitDraft={unitDefaults}
                searchQuery={search}
                rosterCount={students.length}
                rosterAddCandidates={rosterAddCandidates}
                onAddRosterToProject={handleAddRosterToActiveProject}
              />
            </aside>

            <main className="main">
              {selected ? (
                <StudentDetail
                  student={selected}
                  period={period}
                  unitDraft={unitDefaults}
                  onUpdateCourse={updateCourse}
                  onPatchCourse={patchCourse}
                  onAddCourse={() => addCourse(selected.rosterId)}
                  onRemoveCourse={courseIdx => removeCourse(selected.rosterId, courseIdx)}
                  onSetAllInvoiceInclude={include => setAllInvoiceInclude(selected.rosterId, include)}
                  courseCatalogItems={courseCatalog}
                  onAddFromCatalog={item => addCourseFromCatalog(selected.rosterId, item)}
                  onRemoveFromProject={() => removeStudentFromProject(selected.rosterId)}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">③</div>
                  <p>第三步：請從左側選擇一位學生</p>
                  <p className="empty-sub">
                    尚未選人時請先在左側「搜尋與新增學生」將名冊或新人加入本專案；選取學生後即可為該生加入課程、調整金額與產生學費單。需換專案或期別請用上方「返回專案設定」。
                  </p>
                </div>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  )
}
