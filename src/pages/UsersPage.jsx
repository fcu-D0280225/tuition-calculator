import { useEffect, useState } from 'react'
import {
  apiAdminListUsers, apiAdminCreateUser, apiAdminUpdateUser, apiAdminDeleteUser,
  apiAdminListGroups, apiAdminCreateGroup, apiAdminUpdateGroup, apiAdminDeleteGroup,
  apiAuthChangePassword, apiListTeachers,
} from '../data/api.js'

const NAV_OPTIONS = [
  { id: 'dashboard',         label: '財務總覽' },
  { id: 'courses',           label: '家教課' },
  { id: 'groups',            label: '團課' },
  { id: 'lessons',           label: '上課紀錄' },
  { id: 'lessons_tutoring',  label: '家教課上課紀錄' },
  { id: 'lessons_group',     label: '團課上課紀錄' },
  { id: 'attendance',        label: '點名' },
  { id: 'materials',         label: '教材' },
  { id: 'schedule',          label: '課表' },
  { id: 'settlement',        label: '結算' },
  { id: 'settlement_tuition',label: '學費結算' },
  { id: 'settlement_salary', label: '老師薪資結算' },
  { id: 'students',          label: '學生' },
  { id: 'teachers',          label: '老師' },
  { id: 'misc',              label: '雜項支出' },
  { id: 'ai_assistant',      label: 'AI 助理' },
  { id: 'view_rates',        label: '【功能】顯示時薪／金額' },
  { id: 'manage_courses',    label: '【功能】編輯／刪除家教課' },
]

const EMPTY_NEW_USER  = { username: '', password: '', group_id: '', teacher_id: '' }
const EMPTY_NEW_GROUP = { name: '', is_admin: false, permissions: [] }

export default function UsersPage({ currentUser }) {
  const [users, setUsers]   = useState([])
  const [groups, setGroups] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy]   = useState(false)

  // 新增使用者
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser]         = useState(EMPTY_NEW_USER)

  // 新增群組
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [newGroup, setNewGroup]         = useState(EMPTY_NEW_GROUP)

  // 編輯群組 modal
  const [editingGroupId, setEditingGroupId] = useState('')
  const [editGroupName, setEditGroupName]   = useState('')
  const [editGroupIsAdmin, setEditGroupIsAdmin] = useState(false)
  const [editGroupPerms, setEditGroupPerms]     = useState([])

  // 改自己密碼
  const [showPwd, setShowPwd]       = useState(false)
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew]         = useState('')
  const [pwdNew2, setPwdNew2]       = useState('')
  const [pwdMsg, setPwdMsg]         = useState('')

  const editingGroup = groups.find(g => g.id === editingGroupId) || null

  async function reload() {
    setLoading(true); setError('')
    try {
      const [u, g, t] = await Promise.all([apiAdminListUsers(), apiAdminListGroups(), apiListTeachers().catch(() => [])])
      setUsers(u); setGroups(g); setTeachers(t)
    } catch {
      setError('讀取資料失敗')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { reload() }, [])

  function togglePermInList(list, navId) {
    return list.includes(navId) ? list.filter(n => n !== navId) : [...list, navId]
  }

  // ── 建立使用者 ─────────────────────────────────────────
  async function handleCreateUser(e) {
    e.preventDefault()
    if (busy) return
    setError('')
    const uname = newUser.username.trim()
    if (!uname) { setError('請輸入帳號'); return }
    if (newUser.password.length < 6) { setError('密碼至少 6 碼'); return }
    if (!newUser.group_id) { setError('請選擇群組'); return }
    setBusy(true)
    try {
      await apiAdminCreateUser({
        username: uname,
        password: newUser.password,
        group_id: newUser.group_id,
        teacher_id: newUser.teacher_id || null,
      })
      setNewUser(EMPTY_NEW_USER)
      setShowAddUser(false)
      await reload()
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('username_taken'))           setError('帳號已被使用')
      else if (msg.includes('invalid_username'))    setError('帳號不合法（最長 64 字）')
      else if (msg.includes('password_too_short'))  setError('密碼至少 6 碼')
      else if (msg.includes('group_required') || msg.includes('invalid_group')) setError('請選擇有效群組')
      else                                          setError(`建立失敗：${msg.slice(0, 120)}`)
    } finally {
      setBusy(false)
    }
  }

  async function changeUserGroup(user, groupId) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await apiAdminUpdateUser(user.id, { group_id: groupId })
      await reload()
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('cannot_demote_last_admin')) setError('無法切換：這會讓系統失去最後一個管理員')
      else                                          setError('切換群組失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteUser(u) {
    if (!confirm(`確定要刪除使用者「${u.username}」？`)) return
    if (busy) return
    setBusy(true); setError('')
    try {
      await apiAdminDeleteUser(u.id)
      await reload()
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('cannot_delete_self'))           setError('不能刪除自己')
      else if (msg.includes('cannot_delete_last_admin')) setError('不能刪除最後一個管理員')
      else                                              setError('刪除失敗')
    } finally {
      setBusy(false)
    }
  }

  // ── 群組 CRUD ──────────────────────────────────────────
  async function handleCreateGroup(e) {
    e.preventDefault()
    if (busy) return
    setError('')
    const name = newGroup.name.trim()
    if (!name) { setError('請輸入群組名稱'); return }
    setBusy(true)
    try {
      await apiAdminCreateGroup({
        name,
        is_admin: newGroup.is_admin,
        permissions: newGroup.is_admin ? [] : newGroup.permissions,
      })
      setNewGroup(EMPTY_NEW_GROUP)
      setShowAddGroup(false)
      await reload()
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('name_taken'))     setError('群組名稱重複')
      else if (msg.includes('invalid_name')) setError('群組名稱不合法')
      else                                setError('建立群組失敗')
    } finally {
      setBusy(false)
    }
  }

  function startEditGroup(g) {
    setEditingGroupId(g.id)
    setEditGroupName(g.name)
    setEditGroupIsAdmin(g.is_admin)
    setEditGroupPerms(g.is_admin ? [] : [...g.permissions])
    setError('')
  }
  function cancelEditGroup() {
    setEditingGroupId('')
  }
  async function saveEditGroup() {
    if (!editingGroup || busy) return
    setBusy(true); setError('')
    try {
      await apiAdminUpdateGroup(editingGroup.id, {
        name: editGroupName.trim(),
        is_admin: editGroupIsAdmin,
        permissions: editGroupIsAdmin ? [] : editGroupPerms,
      })
      cancelEditGroup()
      await reload()
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('cannot_demote_last_admin_group')) setError('無法降級：這是最後一個管理員群組')
      else if (msg.includes('name_taken'))                setError('群組名稱重複')
      else                                                setError('儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteGroup(g) {
    if (!confirm(`確定要刪除群組「${g.name}」？`)) return
    if (busy) return
    setBusy(true); setError('')
    try {
      await apiAdminDeleteGroup(g.id)
      await reload()
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('group_has_members'))             setError('此群組仍有成員，請先把成員移到其他群組')
      else if (msg.includes('cannot_delete_last_admin_group')) setError('不能刪除最後一個管理員群組')
      else                                               setError('刪除失敗')
    } finally {
      setBusy(false)
    }
  }

  // ── 改自己的密碼 ────────────────────────────────────────
  async function handleChangePwd(e) {
    e.preventDefault()
    setPwdMsg('')
    if (pwdNew.length < 6)   return setPwdMsg('新密碼至少 6 碼')
    if (pwdNew !== pwdNew2)  return setPwdMsg('兩次新密碼不一致')
    if (busy) return
    setBusy(true)
    try {
      await apiAuthChangePassword(pwdCurrent, pwdNew)
      setPwdCurrent(''); setPwdNew(''); setPwdNew2('')
      setPwdMsg('密碼已更新')
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('401'))      setPwdMsg('目前密碼錯誤')
      else if (msg.includes('400')) setPwdMsg('新密碼至少 6 碼')
      else                          setPwdMsg('更新失敗')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>使用者管理</h2>
      </div>

      {/* 改密碼 */}
      <div className="users-section">
        <div className="users-section-header">
          <h3>修改自己的密碼</h3>
          <button
            type="button"
            className={`btn-disclosure${showPwd ? ' open' : ''}`}
            onClick={() => setShowPwd(v => !v)}
            aria-expanded={showPwd}
          >
            <span className="chev" aria-hidden="true" />
            <span>{showPwd ? '收起' : '展開'}</span>
          </button>
        </div>
        {showPwd && (
          <form className="users-pwd-form" onSubmit={handleChangePwd}>
            <input type="password" placeholder="目前密碼" value={pwdCurrent} onChange={e => setPwdCurrent(e.target.value)} autoComplete="current-password" />
            <input type="password" placeholder="新密碼（至少 6 碼）" value={pwdNew} onChange={e => setPwdNew(e.target.value)} autoComplete="new-password" />
            <input type="password" placeholder="再次輸入新密碼" value={pwdNew2} onChange={e => setPwdNew2(e.target.value)} autoComplete="new-password" />
            <button type="submit" disabled={busy || !pwdCurrent || !pwdNew}>更新密碼</button>
            {pwdMsg && <span className="users-pwd-msg">{pwdMsg}</span>}
          </form>
        )}
      </div>

      {currentUser?.is_admin && (
        <>
          {/* 群組列表 */}
          <div className="users-section">
            <div className="users-section-header">
              <h3>群組管理</h3>
              <button type="button" onClick={() => { setShowAddGroup(v => !v); setNewGroup(EMPTY_NEW_GROUP) }}>
                {showAddGroup ? '取消新增' : '＋ 新增群組'}
              </button>
            </div>

            {showAddGroup && (
              <form className="users-add-form" onSubmit={handleCreateGroup}>
                <div className="users-form-row">
                  <label>群組名稱
                    <input value={newGroup.name} onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))} autoFocus />
                  </label>
                  <label className="users-form-checkbox">
                    <input
                      type="checkbox"
                      checked={newGroup.is_admin}
                      onChange={e => setNewGroup(g => ({ ...g, is_admin: e.target.checked }))}
                    />
                    管理員群組（全部權限）
                  </label>
                </div>
                {!newGroup.is_admin && (
                  <div className="users-perm-grid">
                    {NAV_OPTIONS.map(opt => (
                      <label key={opt.id} className="users-perm-item">
                        <input
                          type="checkbox"
                          checked={newGroup.permissions.includes(opt.id)}
                          onChange={() => setNewGroup(g => ({ ...g, permissions: togglePermInList(g.permissions, opt.id) }))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                )}
                <div className="users-form-actions">
                  <button type="submit" disabled={busy}>{busy ? '建立中…' : '建立'}</button>
                </div>
              </form>
            )}

            {error && <div className="users-error">{error}</div>}

            {loading ? <div className="empty-hint">載入中…</div> : (
              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr><th>群組</th><th>類型</th><th>權限</th><th>成員數</th><th></th></tr>
                  </thead>
                  <tbody>
                    {groups.map(g => (
                      <tr key={g.id}>
                        <td>{g.name}</td>
                        <td>{g.is_admin ? <span className="users-perm-all">管理員</span> : '一般'}</td>
                        <td>
                          {g.is_admin
                            ? <span className="users-perm-all">全部</span>
                            : (g.permissions.length === 0
                                ? <span className="users-perm-none">（無）</span>
                                : g.permissions.map(id => NAV_OPTIONS.find(n => n.id === id)?.label || id).join('、'))}
                        </td>
                        <td>{g.member_count} 人</td>
                        <td className="users-row-actions">
                          <button type="button" onClick={() => startEditGroup(g)}>編輯</button>
                          <button type="button" className="btn-danger-sm" onClick={() => handleDeleteGroup(g)} disabled={busy}>刪除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 使用者列表 */}
          <div className="users-section">
            <div className="users-section-header">
              <h3>使用者列表</h3>
              <button type="button" onClick={() => { setShowAddUser(v => !v); setNewUser(EMPTY_NEW_USER) }}>
                {showAddUser ? '取消新增' : '＋ 新增使用者'}
              </button>
            </div>

            {showAddUser && (
              <form className="users-add-form" onSubmit={handleCreateUser}>
                <div className="users-form-row">
                  <label>帳號
                    <input value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} autoFocus />
                  </label>
                  <label>密碼
                    <input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
                  </label>
                  <label>群組
                    <select value={newUser.group_id} onChange={e => setNewUser(u => ({ ...u, group_id: e.target.value }))}>
                      <option value="">── 請選擇 ──</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}{g.is_admin ? '（管理員）' : ''}</option>
                      ))}
                    </select>
                  </label>
                  <label>對應老師（選填，老師帳號才需要）
                    <select value={newUser.teacher_id} onChange={e => setNewUser(u => ({ ...u, teacher_id: e.target.value }))}>
                      <option value="">（無）</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="users-form-actions">
                  <button type="submit" disabled={busy}>{busy ? '建立中…' : '建立'}</button>
                </div>
              </form>
            )}

            {loading ? <div className="empty-hint">載入中…</div> : (
              <div className="users-table-wrap">
                <table className="users-table">
                  <thead>
                    <tr><th>帳號</th><th>群組</th><th>對應老師</th><th></th></tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>{u.username}{u.id === currentUser?.id && <span className="users-self-tag">（你）</span>}</td>
                        <td>
                          <select
                            value={u.group?.id || ''}
                            onChange={e => changeUserGroup(u, e.target.value)}
                            disabled={busy || u.id === currentUser?.id}
                            title={u.id === currentUser?.id ? '不能改自己的群組（避免鎖死）' : ''}
                          >
                            {groups.map(g => (
                              <option key={g.id} value={g.id}>{g.name}{g.is_admin ? '（管理員）' : ''}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={u.teacher_id || ''}
                            onChange={async e => {
                              if (busy) return
                              setBusy(true); setError('')
                              try {
                                await apiAdminUpdateUser(u.id, { teacher_id: e.target.value || null })
                                await reload()
                              } catch (err) {
                                setError(`更新對應老師失敗：${err?.message || err}`)
                              } finally {
                                setBusy(false)
                              }
                            }}
                            disabled={busy}
                          >
                            <option value="">（無）</option>
                            {teachers.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="users-row-actions">
                          {u.id !== currentUser?.id && (
                            <button type="button" className="btn-danger-sm" onClick={() => handleDeleteUser(u)} disabled={busy}>刪除</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* 編輯群組 modal */}
      {editingGroup && (
        <div className="modal-overlay" onClick={() => !busy && cancelEditGroup()}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>編輯群組・{editingGroup.name}</h3>
              <button type="button" className="modal-close" onClick={() => !busy && cancelEditGroup()}>✕</button>
            </div>
            <div className="modal-body">
              <label className="users-form-checkbox" style={{ alignSelf: 'flex-start' }}>
                <span style={{ marginRight: 4 }}>名稱</span>
                <input
                  value={editGroupName}
                  onChange={e => setEditGroupName(e.target.value)}
                  style={{ minWidth: 180 }}
                />
              </label>
              <label className="users-form-checkbox" style={{ alignSelf: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={editGroupIsAdmin}
                  onChange={e => setEditGroupIsAdmin(e.target.checked)}
                />
                管理員群組（自動擁有全部權限）
              </label>
              {!editGroupIsAdmin && (
                <>
                  <div className="roster-summary">頁面權限</div>
                  <div className="users-perm-grid">
                    {NAV_OPTIONS.map(opt => (
                      <label key={opt.id} className="users-perm-item">
                        <input
                          type="checkbox"
                          checked={editGroupPerms.includes(opt.id)}
                          onChange={() => setEditGroupPerms(p => togglePermInList(p, opt.id))}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </>
              )}
              {error && <div className="users-error">{error}</div>}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={cancelEditGroup} disabled={busy}>取消</button>
              <button type="button" className="btn-primary" onClick={saveEditGroup} disabled={busy || !editGroupName.trim()}>
                {busy ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
