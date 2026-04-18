import { useState, useMemo, useEffect } from 'react'

export default function StudentRosterPage({
  roster,
  loading,
  error,
  onRenameRoster,
  onDeleteRoster,
  onAddRoster,
  onRetry,
  projects,
  activeProjectId,
  onAddRosterToActiveProject,
}) {
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')

  const activeProject = useMemo(
    () => projects.find(p => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  )

  const rosterIdsInActive = useMemo(() => {
    if (!activeProject) return new Set()
    return new Set(activeProject.students.map(s => s.rosterId))
  }, [activeProject])

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return roster
    return roster.filter(r => r.name.includes(q))
  }, [roster, search])

  function rosterIdUsedAnywhere(rosterId) {
    return projects.some(p => p.students.some(s => s.rosterId === rosterId))
  }

  function handleRename(id, name) {
    const n = String(name).trim()
    if (!n) {
      window.alert('姓名不可空白')
      return
    }
    onRenameRoster(id, n)
  }

  function handleDelete(id) {
    if (rosterIdUsedAnywhere(id)) {
      window.alert('此學生在至少一個專案中仍有收費資料，請先從各專案中移除該生後再刪除名冊。')
      return
    }
    if (!window.confirm('從名冊刪除此學生？（僅限未加入任何專案者）')) return
    onDeleteRoster(id)
  }

  async function handleAddOnlyToRoster(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) {
      window.alert('請輸入姓名')
      return
    }
    if (roster.some(r => r.name === name)) {
      if (!window.confirm('名冊已有相同姓名，仍要新增一筆（不同學生可同名）？')) return
    }
    const created = await onAddRoster(name)
    if (created) setNewName('')
  }

  return (
    <div className="roster-page">
      <header className="roster-header">
        <h1 className="roster-title">學生名冊</h1>
        <p className="roster-sub">
          全站共用一份名冊（儲存於伺服器 DB）；各「當月專案」從名冊挑人後，再維護該期的課程與金額。在此可新增名冊（不一定立刻加入目前專案）、改名、刪除（僅限尚未出現在任何專案者）。
        </p>
      </header>

      {error && (
        <div className="roster-error">
          <span>名冊載入失敗：{error}</span>
          {onRetry && (
            <button type="button" className="btn-roster-retry" onClick={onRetry}>
              重試
            </button>
          )}
        </div>
      )}

      <div className="roster-toolbar">
        <input
          className="roster-search"
          placeholder="搜尋姓名…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <form className="roster-add-form" onSubmit={handleAddOnlyToRoster}>
          <input
            className="roster-add-input"
            placeholder="新學生姓名（只加入名冊）"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            maxLength={32}
          />
          <button type="submit" className="btn-roster-add">
            ＋ 加入名冊
          </button>
        </form>
      </div>

      <div className="roster-table-wrap">
        <table className="roster-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th className="roster-col-id">名冊 ID</th>
              <th className="roster-col-status">目前專案</th>
              <th className="roster-col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const inActive = rosterIdsInActive.has(r.id)
              const nProjects = projects.filter(p => p.students.some(s => s.rosterId === r.id)).length
              return (
                <tr key={r.id}>
                  <td>
                    <RosterNameCell initial={r.name} onCommit={name => handleRename(r.id, name)} />
                  </td>
                  <td className="roster-col-id">
                    <code className="roster-id-code">{r.id}</code>
                  </td>
                  <td className="roster-col-status">
                    {inActive ? (
                      <span className="roster-badge roster-badge-in">已在「目前專案」</span>
                    ) : (
                      <span className="roster-badge roster-badge-out">未加入本期</span>
                    )}
                    <span className="roster-meta">{nProjects} 個專案含此學生</span>
                  </td>
                  <td className="roster-col-actions">
                    {!inActive && (
                      <button
                        type="button"
                        className="btn-roster-join"
                        onClick={() => onAddRosterToActiveProject(r.id)}
                      >
                        加入目前專案
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-roster-del"
                      onClick={() => handleDelete(r.id)}
                      title="若學生仍在任一專案中則無法刪除"
                    >
                      刪除名冊
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="roster-empty">
            {loading ? '名冊載入中…' : search.trim() ? '找不到符合的學生' : '名冊尚無學生'}
          </p>
        )}
      </div>
    </div>
  )
}

function RosterNameCell({ initial, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(initial)

  useEffect(() => {
    if (!editing) setVal(initial)
  }, [initial, editing])

  function finish() {
    const t = val.trim()
    if (!t) {
      setVal(initial)
      setEditing(false)
      return
    }
    onCommit(t)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="roster-name-edit">
        <input
          className="roster-name-input"
          value={val}
          onChange={e => setVal(e.target.value)}
          autoFocus
          onBlur={finish}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setVal(initial)
              setEditing(false)
            }
          }}
        />
      </div>
    )
  }

  return (
    <button type="button" className="roster-name-btn" onClick={() => { setVal(initial); setEditing(true) }}>
      {initial}
    </button>
  )
}
