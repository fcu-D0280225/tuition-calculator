import { useState, useRef, useMemo } from 'react'
import { defaultPeriodLabel } from '../data/monthProjects'

export default function MonthProjectBar({
  projects,
  activeProjectId,
  studentRoster = [],
  onSwitchProject,
  onRenameProject,
  onCreateProjectFromRoster,
  onDuplicateProject,
  onImportProjectToNew,
  onDeleteProject,
}) {
  const active = projects.find(p => p.id === activeProjectId)
  const canDelete = projects.length > 1
  const newProjDetailsRef = useRef(null)

  const [importDraft, setImportDraft] = useState({
    sourceId: '',
    newLabel: '',
  })

  const [newProjLabel, setNewProjLabel] = useState('')
  /** 新專案將納入的學生（依加入順序） */
  const [newProjPickedIds, setNewProjPickedIds] = useState([])
  const [newProjRosterFilter, setNewProjRosterFilter] = useState('')
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [duplicateLabel, setDuplicateLabel] = useState('')

  function syncImportDraftOnOpen() {
    setImportDraft({
      sourceId: activeProjectId || projects[0]?.id || '',
      newLabel: defaultPeriodLabel(),
    })
  }

  function syncNewProjectFormOnOpen() {
    setNewProjLabel(defaultPeriodLabel())
    setNewProjPickedIds([])
    setNewProjRosterFilter('')
  }

  const rosterById = useMemo(() => new Map(studentRoster.map(r => [r.id, r])), [studentRoster])

  const pickedEntries = useMemo(
    () => newProjPickedIds.map(id => rosterById.get(id)).filter(Boolean),
    [newProjPickedIds, rosterById]
  )

  const availableEntries = useMemo(() => {
    const picked = new Set(newProjPickedIds)
    const q = newProjRosterFilter.trim()
    return studentRoster
      .filter(r => !picked.has(r.id))
      .filter(r => !q || r.name.includes(q))
  }, [studentRoster, newProjPickedIds, newProjRosterFilter])

  function addOneToNewProject(id) {
    if (!id || newProjPickedIds.includes(id)) return
    setNewProjPickedIds(prev => [...prev, id])
  }

  function removeOneFromNewProject(id) {
    setNewProjPickedIds(prev => prev.filter(x => x !== id))
  }

  function addAllFromRosterToNewProject() {
    setNewProjPickedIds(studentRoster.map(r => r.id))
  }

  function clearNewProjectPicked() {
    setNewProjPickedIds([])
  }

  function submitNewProject() {
    const label = (newProjLabel || '').trim() || defaultPeriodLabel()
    const rosterIds = [...newProjPickedIds]
    if (rosterIds.length === 0) {
      window.alert('請從名冊至少加入一位學生，或先到「學生名冊」維護名冊。')
      return
    }
    onCreateProjectFromRoster({ label, rosterIds })
    if (newProjDetailsRef.current) newProjDetailsRef.current.open = false
  }

  return (
    <div className="month-project-bar">
      <details className="month-project-tools-collapse" open>
        <summary className="month-project-tools-summary">
          <span className="month-project-tools-summary-title">當月專案 · 切換與管理</span>
          <span className="month-project-tools-summary-meta">
            {active ? `${active.label}（${active.students.length} 人）` : '—'}
          </span>
        </summary>
        <div className="month-project-tools-body">
          <div className="month-project-bar-row">
            <label className="month-project-label" htmlFor="month-project-select">
              當月專案
            </label>
            <select
              id="month-project-select"
              className="month-project-select"
              value={activeProjectId}
              onChange={e => onSwitchProject(e.target.value)}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}（{p.students.length} 位學生）
                </option>
              ))}
            </select>
            <details
              ref={newProjDetailsRef}
              className="month-project-new-inline"
              onToggle={e => {
                if (e.currentTarget.open) syncNewProjectFormOnOpen()
              }}
            >
              <summary className="btn-month-project month-project-new-summary">＋ 建立新專案（自名冊選學生）</summary>
              <div className="month-project-new-body">
                <p className="month-project-new-hint">
                  依序從名冊<strong>加入</strong>學生；下方「已選」可<strong>移除</strong>。每人會先有一列空白課程。名冊請在頂部「學生名冊」維護。
                </p>
                <label className="month-project-new-label">
                  <span className="month-project-sublabel">新專案期別</span>
                  <input
                    className="month-project-period-input"
                    value={newProjLabel}
                    onChange={e => setNewProjLabel(e.target.value)}
                    placeholder={defaultPeriodLabel()}
                    maxLength={48}
                  />
                </label>

                <div className="month-project-new-section">
                  <div className="month-project-new-section-head">
                    <span className="month-project-new-section-title">
                      已選學生（{pickedEntries.length} 人）
                    </span>
                    <div className="month-project-new-actions month-project-new-actions--inline">
                      <button type="button" className="btn-link-like" onClick={addAllFromRosterToNewProject}>
                        一次加入全部名冊
                      </button>
                      <span className="sep">·</span>
                      <button
                        type="button"
                        className="btn-link-like"
                        onClick={clearNewProjectPicked}
                        disabled={newProjPickedIds.length === 0}
                      >
                        清空已選
                      </button>
                    </div>
                  </div>
                  {pickedEntries.length === 0 ? (
                    <p className="month-project-new-empty month-project-new-empty--boxed">
                      尚未選人，請從下方名冊按「加入」。
                    </p>
                  ) : (
                    <ol className="month-project-picked-list">
                      {pickedEntries.map((r, idx) => (
                        <li key={r.id} className="month-project-picked-row">
                          <span className="month-project-picked-idx">{idx + 1}.</span>
                          <span className="month-project-picked-name">{r.name}</span>
                          <button
                            type="button"
                            className="btn-month-project-tiny btn-month-project-tiny--danger"
                            onClick={() => removeOneFromNewProject(r.id)}
                          >
                            移除此人
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="month-project-new-section">
                  <div className="month-project-new-section-head">
                    <span className="month-project-new-section-title">從名冊加入（尚未選入者）</span>
                  </div>
                  {studentRoster.length === 0 ? (
                    <p className="month-project-new-empty month-project-new-empty--boxed">
                      名冊尚無學生，請先到「學生名冊」新增。
                    </p>
                  ) : (
                    <>
                      <input
                        type="search"
                        className="month-project-roster-filter"
                        placeholder="篩選姓名…"
                        value={newProjRosterFilter}
                        onChange={e => setNewProjRosterFilter(e.target.value)}
                        aria-label="篩選名冊姓名"
                      />
                      <div className="month-project-roster-pick month-project-roster-pick--rows">
                        {availableEntries.length === 0 ? (
                          <p className="month-project-new-empty">
                            {newProjRosterFilter.trim()
                              ? '沒有符合篩選的未選學生'
                              : '名冊中的人已全部加入已選清單'}
                          </p>
                        ) : (
                          <ul className="month-project-available-list">
                            {availableEntries.map(r => (
                              <li key={r.id} className="month-project-available-row">
                                <span className="month-project-available-name">{r.name}</span>
                                <button
                                  type="button"
                                  className="btn-month-project-tiny btn-month-project-tiny--primary"
                                  onClick={() => addOneToNewProject(r.id)}
                                >
                                  加入
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-month-project btn-month-project-primary"
                  disabled={studentRoster.length === 0 || newProjPickedIds.length === 0}
                  onClick={submitNewProject}
                >
                  建立此專案
                </button>
              </div>
            </details>
            {showDuplicate ? (
              <form
                className="month-project-duplicate-form"
                onSubmit={e => {
                  e.preventDefault()
                  const label = duplicateLabel.trim() || defaultPeriodLabel()
                  onDuplicateProject(label)
                  setShowDuplicate(false)
                  setDuplicateLabel('')
                }}
              >
                <input
                  className="month-project-period-input"
                  value={duplicateLabel}
                  onChange={e => setDuplicateLabel(e.target.value)}
                  placeholder={defaultPeriodLabel()}
                  maxLength={48}
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      setShowDuplicate(false)
                      setDuplicateLabel('')
                    }
                  }}
                  aria-label="新複本的期別名稱"
                />
                <button type="submit" className="btn-month-project btn-month-project-primary">
                  建立複本
                </button>
                <button
                  type="button"
                  className="btn-month-project"
                  onClick={() => {
                    setShowDuplicate(false)
                    setDuplicateLabel('')
                  }}
                >
                  取消
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="btn-month-project"
                onClick={() => {
                  setDuplicateLabel(defaultPeriodLabel())
                  setShowDuplicate(true)
                }}
              >
                複製目前專案
              </button>
            )}
            <button
              type="button"
              className="btn-month-project btn-month-project-danger"
              disabled={!canDelete}
              title={canDelete ? '刪除此專案與其學生資料' : '至少需保留一個專案'}
              onClick={() => {
                if (!canDelete || !active) return
                if (
                  !window.confirm(
                    `確定刪除專案「${active.label}」？此專案內所有學生與課程資料將一併刪除，無法還原。`
                  )
                ) {
                  return
                }
                onDeleteProject(active.id)
              }}
            >
              刪除此專案
            </button>
          </div>
        </div>
      </details>
      <details className="collapsible-extra month-project-extra" open>
        <summary className="collapsible-extra-summary">期別抬頭、匯入專案、說明（可收合）</summary>
        <div className="collapsible-extra-body">
          <p className="month-project-hint">
            每位學生、預設單價與整包 PDF 都屬於目前選取的專案；切換專案即可編輯不同月份的內容，不會依電腦日期自動變更。
          </p>
          {active && (
            <div className="month-project-period-edit month-project-period-edit--in-panel">
              <label>
                <span className="month-project-sublabel">此專案期別（學費單抬頭）</span>
                <input
                  className="month-project-period-input"
                  value={active.label}
                  onChange={e => onRenameProject(active.id, e.target.value)}
                  placeholder="例：2026年4月"
                  maxLength={48}
                />
              </label>
            </div>
          )}
          <details
            className="month-project-import"
            onToggle={e => {
              if (e.currentTarget.open) syncImportDraftOnOpen()
            }}
          >
            <summary className="month-project-import-summary">從其他專案匯入到新專案</summary>
            <div className="month-project-import-body">
              <p className="month-project-import-desc">
                選擇要複製的來源專案（完整學生、課程與本專案預設單價），再為新專案命名期別。新專案與來源互不影響；預設開啟時會選取「目前專案」為來源，可改選任意月份。
              </p>
              <div className="month-project-import-grid">
                <label className="month-project-import-field">
                  <span className="month-project-sublabel">來源專案</span>
                  <select
                    className="month-project-select month-project-select--full"
                    value={importDraft.sourceId || activeProjectId || ''}
                    onChange={e => setImportDraft(d => ({ ...d, sourceId: e.target.value }))}
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.label}（{p.students.length} 人）
                      </option>
                    ))}
                  </select>
                </label>
                <label className="month-project-import-field">
                  <span className="month-project-sublabel">新專案期別</span>
                  <input
                    className="month-project-period-input"
                    value={importDraft.newLabel}
                    onChange={e => setImportDraft(d => ({ ...d, newLabel: e.target.value }))}
                    placeholder="例：2026年5月"
                    maxLength={48}
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn-month-project btn-month-project-primary"
                disabled={!projects.length || !(importDraft.sourceId || activeProjectId)}
                onClick={() => {
                  const sid = importDraft.sourceId || activeProjectId
                  if (!sid) {
                    window.alert('請選擇來源專案。')
                    return
                  }
                  onImportProjectToNew(sid, importDraft.newLabel)
                }}
              >
                建立新專案並匯入
              </button>
            </div>
          </details>
        </div>
      </details>
    </div>
  )
}
