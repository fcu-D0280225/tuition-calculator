import { useEffect, useState } from 'react'
import { apiAdminListGroups, apiCreateInvite, apiListInvites, apiDeleteInvite } from '../data/api.js'

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
  }
  // fallback execCommand
  const el = document.createElement('textarea')
  el.value = text
  el.style.position = 'fixed'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
  return Promise.resolve()
}

function fmtDate(dt) {
  if (!dt) return ''
  return String(dt).slice(0, 16).replace('T', ' ')
}

export default function InvitesPage() {
  const [groups, setGroups]   = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // 產生邀請 form
  const [groupId, setGroupId]       = useState('')
  const [expireDays, setExpireDays] = useState(7)
  const [creating, setCreating]     = useState(false)
  const [newInviteUrl, setNewInviteUrl] = useState('')
  const [createError, setCreateError]  = useState('')
  const [copied, setCopied]            = useState(false)

  // 撤銷
  const [revoking, setRevoking] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [g, inv] = await Promise.all([apiAdminListGroups(), apiListInvites()])
      setGroups(g || [])
      setInvites(inv || [])
      if (!groupId && g?.length) setGroupId(g[0].id)
    } catch {
      setError('載入失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError('')
    setNewInviteUrl('')
    setCopied(false)
    if (!groupId) { setCreateError('請選擇群組'); return }
    const days = parseInt(expireDays, 10)
    if (isNaN(days) || days < 1 || days > 30) { setCreateError('有效天數需在 1~30 之間'); return }
    setCreating(true)
    try {
      const result = await apiCreateInvite(groupId, days)
      const fullUrl = window.location.origin + result.invite_url
      setNewInviteUrl(fullUrl)
      await load()
    } catch (err) {
      const body = err?.body
      if (body?.error === 'invalid_group') setCreateError('群組不存在或不屬於此補習班')
      else if (body?.error === 'expires_in_days_out_of_range') setCreateError('有效天數需在 1~30 之間')
      else setCreateError('產生失敗，請稍後再試')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(token) {
    setRevoking(token)
    try {
      await apiDeleteInvite(token)
      setInvites(prev => prev.filter(i => i.token !== token))
    } catch (err) {
      const body = err?.body
      if (body?.error === 'already_used') alert('此邀請已被使用，無法撤銷')
      else alert('撤銷失敗，請稍後再試')
    } finally {
      setRevoking(null)
    }
  }

  async function handleCopy() {
    try {
      await copyToClipboard(newInviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('複製失敗，請手動複製')
    }
  }

  function statusBadge(status, usedByUsername) {
    if (status === 'active')  return <span style={{ color: '#16a34a', fontWeight: 600 }}>有效</span>
    if (status === 'used')    return <span style={{ color: '#888' }}>已使用（{usedByUsername || '—'}）</span>
    if (status === 'expired') return <span style={{ color: '#dc2626' }}>已過期</span>
    return <span>{status}</span>
  }

  if (loading) return <div className="page"><div className="empty-hint">載入中⋯</div></div>
  if (error)   return <div className="page"><div className="empty-hint" style={{ color: '#dc2626' }}>{error}</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h2 style={{ margin: 0 }}>邀請管理</h2>
      </div>

      {/* 產生邀請 */}
      <div className="users-section" style={{ marginBottom: 24 }}>
        <div className="users-section-header">產生新邀請</div>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary, #888)' }}>群組（角色）</span>
            <select
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              disabled={creating}
              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)', background: 'var(--bg, #fff)', fontSize: 14 }}
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}{g.is_admin ? '（管理員）' : ''}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 120 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary, #888)' }}>有效天數</span>
            <input
              type="number"
              min={1}
              max={30}
              value={expireDays}
              onChange={e => setExpireDays(e.target.value)}
              disabled={creating}
              style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #d1d5db)', background: 'var(--bg, #fff)', fontSize: 14, width: '100%' }}
            />
          </label>
          <button
            type="submit"
            className="btn-primary"
            disabled={creating || !groupId}
            style={{ padding: '7px 18px', height: 36 }}
          >
            {creating ? '產生中…' : '產生邀請連結'}
          </button>
        </form>
        {createError && (
          <div style={{ marginTop: 10, color: '#dc2626', fontSize: 14 }}>{createError}</div>
        )}
        {newInviteUrl && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-secondary, #f3f4f6)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, wordBreak: 'break-all', flex: 1 }}>{newInviteUrl}</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopy}
              style={{ whiteSpace: 'nowrap', padding: '5px 14px' }}
            >
              {copied ? '已複製！' : '複製'}
            </button>
          </div>
        )}
      </div>

      {/* 邀請列表 */}
      <div className="users-section">
        <div className="users-section-header">邀請紀錄</div>
        {invites.length === 0 ? (
          <div className="empty-hint">尚無邀請紀錄</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="settlement-table">
              <thead>
                <tr>
                  <th>建立時間</th>
                  <th>角色</th>
                  <th>狀態</th>
                  <th>過期時間</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {invites.map(inv => (
                  <tr key={inv.token}>
                    <td style={{ fontSize: 13 }}>{fmtDate(inv.created_at)}</td>
                    <td>{inv.group?.name || '—'}</td>
                    <td>{statusBadge(inv.status, inv.used_by_username)}</td>
                    <td style={{ fontSize: 13 }}>{fmtDate(inv.expires_at)}</td>
                    <td>
                      {inv.status === 'active' && (
                        <button
                          type="button"
                          className="btn-sm btn-danger"
                          disabled={revoking === inv.token}
                          onClick={() => handleRevoke(inv.token)}
                        >
                          {revoking === inv.token ? '撤銷中…' : '撤銷'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
