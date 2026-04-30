import { useEffect, useState } from 'react'
import {
  apiAdminListUsers, apiAdminCreateUser, apiAdminUpdateUser, apiAdminDeleteUser,
  apiAuthChangePassword,
} from '../data/api.js'

const NAV_OPTIONS = [
  { id: 'dashboard',  label: '財務總覽' },
  { id: 'courses',    label: '家教課' },
  { id: 'groups',     label: '團課' },
  { id: 'lessons',    label: '上課紀錄' },
  { id: 'attendance', label: '點名' },
  { id: 'materials',  label: '教材' },
  { id: 'settlement', label: '結算' },
  { id: 'students',   label: '學生' },
  { id: 'teachers',   label: '老師' },
]

const EMPTY_NEW = { username: '', password: '', is_admin: false, permissions: [] }

export default function UsersPage({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState(EMPTY_NEW)

  const [editingId, setEditingId] = useState('')
  const [editIsAdmin, setEditIsAdmin] = useState(false)
  const [editPerms, setEditPerms] = useState([])

  const [showPwd, setShowPwd] = useState(false)
  const [pwdCurrent, setPwdCurrent] = useState('')
  const [pwdNew, setPwdNew] = useState('')
  const [pwdNew2, setPwdNew2] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')

  async function reload() {
    setLoading(true); setError('')
    try {
      setUsers(await apiAdminListUsers())
    } catch {
      setError('讀取使用者失敗')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { reload() }, [])

  function togglePermInList(list, navId) {
    return list.includes(navId) ? list.filter(n => n !== navId) : [...list, navId]
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      await apiAdminCreateUser({
        username: newUser.username.trim(),
        password: newUser.password,
        is_admin: newUser.is_admin,
        permissions: newUser.is_admin ? [] : newUser.permissions,
      })
      setNewUser(EMPTY_NEW)
      setShowAdd(false)
      await reload()
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('409'))      setError('帳號已被使用')
      else if (msg.includes('400')) setError('帳號或密碼格式不符（密碼至少 6 碼）')
      else                          setError('建立失敗')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(u) {
    setEditingId(u.id)
    setEditIsAdmin(u.is_admin)
    setEditPerms(u.is_admin ? [] : [...u.permissions])
    setError('')
  }
  function cancelEdit() {
    setEditingId('')
    setEditIsAdmin(false)
    setEditPerms([])
  }

  async function saveEdit(u) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await apiAdminUpdateUser(u.id, {
        is_admin: editIsAdmin,
        permissions: editIsAdmin ? [] : editPerms,
      })
      cancelEdit()
      await reload()
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('cannot_demote_last_admin')) setError('不能降級最後一個 admin')
      else                                          setError('儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(u) {
    if (!confirm(`確定要刪除使用者「${u.username}」？`)) return
    if (busy) return
    setBusy(true); setError('')
    try {
      await apiAdminDeleteUser(u.id)
      await reload()
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('cannot_delete_self'))      setError('不能刪除自己')
      else if (msg.includes('cannot_delete_last_admin')) setError('不能刪除最後一個 admin')
      else                                         setError('刪除失敗')
    } finally {
      setBusy(false)
    }
  }

  async function handleChangePwd(e) {
    e.preventDefault()
    setPwdMsg('')
    if (pwdNew.length < 6)        return setPwdMsg('新密碼至少 6 碼')
    if (pwdNew !== pwdNew2)       return setPwdMsg('兩次新密碼不一致')
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
        <div className="users-section">
          <div className="users-section-header">
            <h3>使用者列表</h3>
            <button type="button" onClick={() => { setShowAdd(v => !v); setNewUser(EMPTY_NEW) }}>
              {showAdd ? '取消新增' : '＋ 新增使用者'}
            </button>
          </div>

          {showAdd && (
            <form className="users-add-form" onSubmit={handleCreate}>
              <div className="users-form-row">
                <label>帳號
                  <input value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))} autoFocus />
                </label>
                <label>密碼
                  <input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
                </label>
                <label className="users-form-checkbox">
                  <input
                    type="checkbox"
                    checked={newUser.is_admin}
                    onChange={e => setNewUser(u => ({ ...u, is_admin: e.target.checked }))}
                  />
                  管理員（全部權限）
                </label>
              </div>
              {!newUser.is_admin && (
                <div className="users-perm-grid">
                  {NAV_OPTIONS.map(opt => (
                    <label key={opt.id} className="users-perm-item">
                      <input
                        type="checkbox"
                        checked={newUser.permissions.includes(opt.id)}
                        onChange={() => setNewUser(u => ({ ...u, permissions: togglePermInList(u.permissions, opt.id) }))}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
              <div className="users-form-actions">
                <button type="submit" disabled={busy || !newUser.username.trim() || newUser.password.length < 6}>建立</button>
              </div>
            </form>
          )}

          {error && <div className="users-error">{error}</div>}

          {loading ? <div className="empty-hint">載入中…</div> : (
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr><th>帳號</th><th>角色</th><th>權限</th><th></th></tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const editing = editingId === u.id
                    return (
                      <tr key={u.id}>
                        <td>{u.username}{u.id === currentUser?.id && <span className="users-self-tag">（你）</span>}</td>
                        <td>
                          {editing ? (
                            <label className="users-form-checkbox">
                              <input
                                type="checkbox"
                                checked={editIsAdmin}
                                onChange={e => setEditIsAdmin(e.target.checked)}
                              />
                              管理員
                            </label>
                          ) : (u.is_admin ? '管理員' : '一般使用者')}
                        </td>
                        <td>
                          {editing && !editIsAdmin ? (
                            <div className="users-perm-grid users-perm-grid--inline">
                              {NAV_OPTIONS.map(opt => (
                                <label key={opt.id} className="users-perm-item">
                                  <input
                                    type="checkbox"
                                    checked={editPerms.includes(opt.id)}
                                    onChange={() => setEditPerms(p => togglePermInList(p, opt.id))}
                                  />
                                  {opt.label}
                                </label>
                              ))}
                            </div>
                          ) : (
                            u.is_admin ? <span className="users-perm-all">全部</span>
                            : (u.permissions.length === 0
                                ? <span className="users-perm-none">（無）</span>
                                : u.permissions
                                    .map(id => NAV_OPTIONS.find(n => n.id === id)?.label || id)
                                    .join('、'))
                          )}
                        </td>
                        <td className="users-row-actions">
                          {editing ? (
                            <>
                              <button type="button" className="btn-primary-sm" onClick={() => saveEdit(u)} disabled={busy}>儲存</button>
                              <button type="button" onClick={cancelEdit}>取消</button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => startEdit(u)}>編輯權限</button>
                              {u.id !== currentUser?.id && (
                                <button type="button" className="btn-danger-sm" onClick={() => handleDelete(u)} disabled={busy}>刪除</button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
