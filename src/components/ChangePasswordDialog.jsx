import { useState } from 'react'
import { apiChangePassword } from '../data/api.js'

export default function ChangePasswordDialog({ forced, onDone, onCancel }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (newPassword.length < 6) {
      setError('新密碼至少需要 6 個字元')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('兩次輸入的新密碼不一致')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await apiChangePassword(currentPassword, newPassword)
      onDone?.()
    } catch {
      setError('變更失敗，請確認目前密碼是否正確')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">{forced ? '首次登入：請變更密碼' : '變更密碼'}</h1>
        <label className="login-field">
          <span>目前密碼</span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        </label>
        <label className="login-field">
          <span>新密碼</span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting}
          />
        </label>
        <label className="login-field">
          <span>再次輸入新密碼</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
          />
        </label>
        {error && <div className="login-error">{error}</div>}
        <div className="login-actions">
          {!forced && (
            <button type="button" className="login-secondary" onClick={onCancel} disabled={submitting}>
              取消
            </button>
          )}
          <button type="submit" className="login-submit" disabled={submitting}>
            {submitting ? '送出中…' : '確認變更'}
          </button>
        </div>
      </form>
    </div>
  )
}
