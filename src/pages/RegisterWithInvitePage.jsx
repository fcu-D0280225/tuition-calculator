import { useEffect, useState } from 'react'
import { apiGetInvite, apiRegisterWithInvite } from '../data/api.js'

export default function RegisterWithInvitePage({ token }) {
  const [state, setState] = useState({ loading: true, error: '', info: null })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiGetInvite(token).then(
      (data) => { if (!cancelled) setState({ loading: false, error: '', info: data }) },
      (err) => {
        if (cancelled) return
        const status = err?.status
        const body = err?.body
        let msg = '載入失敗，請稍後再試'
        if (status === 404) msg = '邀請連結無效'
        else if (status === 410 && body?.error === 'already_used') msg = '此邀請連結已被使用過'
        else if (status === 410) msg = '邀請已過期，請聯絡管理員重新產生'
        setState({ loading: false, error: msg, info: null })
      }
    )
    return () => { cancelled = true }
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    if (password.length < 6) { setFormError('密碼至少 6 個字元'); return }
    if (password !== confirmPw) { setFormError('兩次密碼不一致'); return }
    setSubmitting(true)
    try {
      await apiRegisterWithInvite(token, username.trim(), password)
      setSuccess(true)
      setTimeout(() => { window.location.href = '/' }, 1500)
    } catch (err) {
      const body = err?.body
      const status = err?.status
      if (status === 409 && body?.error === 'username_taken') setFormError('此使用者名稱已被使用')
      else if (status === 400 && body?.error === 'password_too_short') setFormError('密碼至少 6 個字元')
      else setFormError('註冊失敗，請稍後再試')
    } finally {
      setSubmitting(false)
    }
  }

  if (state.loading) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-title">補習班管理系統</div>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary, #888)', padding: '16px 0' }}>載入中⋯</div>
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-title">補習班管理系統</div>
          <div className="login-error" style={{ marginTop: 8 }}>{state.error}</div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <div className="login-title">補習班管理系統</div>
          <div style={{ textAlign: 'center', color: '#16a34a', padding: '16px 0' }}>
            註冊成功，正在進入系統…
          </div>
        </div>
      </div>
    )
  }

  const { tenant, group, expires_at } = state.info
  const expiresLabel = expires_at ? expires_at.slice(0, 10) : ''

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-title">補習班管理系統</div>
        <div style={{ marginBottom: 16, padding: '10px 12px', background: 'var(--bg-secondary, #f3f4f6)', borderRadius: 8, fontSize: 14 }}>
          <div>您即將加入 <strong>{tenant.name}</strong></div>
          <div style={{ color: 'var(--text-secondary, #888)', marginTop: 4 }}>角色：{group.name}</div>
          {expiresLabel && <div style={{ color: 'var(--text-secondary, #888)', marginTop: 2, fontSize: 12 }}>連結有效期：{expiresLabel}</div>}
        </div>
        <label className="login-field">
          <span>帳號</span>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            disabled={submitting}
            placeholder="請設定登入帳號"
          />
        </label>
        <label className="login-field">
          <span>密碼</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={submitting}
            placeholder="至少 6 個字元"
          />
        </label>
        <label className="login-field">
          <span>確認密碼</span>
          <input
            type="password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            autoComplete="new-password"
            disabled={submitting}
            placeholder="再次輸入密碼"
          />
        </label>
        {formError && <div className="login-error">{formError}</div>}
        <button
          type="submit"
          className="login-submit"
          disabled={submitting || !username || !password || !confirmPw}
        >
          {submitting ? '註冊中…' : '完成註冊'}
        </button>
      </form>
    </div>
  )
}
