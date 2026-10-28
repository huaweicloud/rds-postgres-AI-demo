import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Message from './Message'
import { getErrorMessage } from '../lib/errors'

export default function ResetPasswordInline({ onCancel }) {
  const { updatePassword } = useAuth()
  const { t, language } = useLanguage()
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })
    setLoading(true)

    const { error } = await updatePassword(newPassword)
    setLoading(false)

    if (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, language) })
    } else {
      setMessage({ type: 'success', text: t.message.passwordUpdated })
      setNewPassword('')
    }
  }

  return (
    <div className="reset-password-section">
      <h2 className="reset-password-title">{t.resetPassword.title}</h2>
      <p className="reset-password-subtitle">{t.resetPassword.subtitle}</p>

      <Message type={message.type} text={message.text} />

      <form className="reset-password-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label" htmlFor="new-password">{t.resetPassword.newPassword}</label>
          <input
            id="new-password"
            type="password"
            className="form-input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t.auth.passwordPlaceholder}
            minLength={6}
            required
          />
        </div>
        <div className="reset-password-actions">
          <button className="btn-submit" type="submit" disabled={loading}>
            {loading ? t.resetPassword.updating : t.resetPassword.updatePassword}
          </button>
          <button className="btn-cancel" type="button" onClick={onCancel} disabled={loading}>
            {t.resetPassword.cancel}
          </button>
        </div>
      </form>
    </div>
  )
}
