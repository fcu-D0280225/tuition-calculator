import { useState } from 'react'
import { apiLogin } from '../data/api.js'

export default function LoginPage({ onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('請輸入帳號與密碼')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const data = await apiLogin(username.trim(), password)
      onLoggedIn?.(data.user)
    } catch {
      setError('帳號或密碼錯誤')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">補習班管理系統</h1>
        <p className="login-subtitle">請先登入以繼續</p>
        <label className="login-field">
          <span>帳號</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        </label>
        <label className="login-field">
          <span>密碼</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="login-submit" disabled={submitting}>
          {submitting ? '登入中…' : '登入'}
        </button>
        <div className="login-hint">首次登入請使用 admin / admin123 並立即變更密碼</div>
      </form>
    </div>
  )
}
