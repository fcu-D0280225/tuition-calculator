import { useState } from 'react'
import { apiAuthLogin } from '../data/api.js'

export default function LoginPage({ onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [tenantId, setTenantId] = useState(1)
  const [showTenant, setShowTenant] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError(''); setLoading(true)
    try {
      const data = await apiAuthLogin(username.trim(), password, showTenant ? tenantId : 1)
      onLoggedIn?.(data)
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('401')) setError('帳號或密碼錯誤')
      else                     setError('登入失敗，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-title">補習班管理系統</div>
        <label className="login-field">
          <span>帳號</span>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            disabled={loading}
          />
        </label>
        <label className="login-field">
          <span>密碼</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
        </label>
        {showTenant && (
          <label className="login-field">
            <span>補習班代號</span>
            <input
              type="number"
              min={1}
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              disabled={loading}
            />
          </label>
        )}
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="login-submit" disabled={loading || !username || !password}>
          {loading ? '登入中…' : '登入'}
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowTenant(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', padding: 0 }}
          >
            {showTenant ? '隱藏補習班代號' : '使用其他補習班登入'}
          </button>
          <a href="/referral" className="login-referral-link">
            了解更多功能介紹 →
          </a>
        </div>
      </form>
    </div>
  )
}
