import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Message from './Message'
import { getErrorMessage } from '../lib/errors'

export default function ResetPassword({ type }) {
  const { resetPassword, updatePassword } = useAuth()
  const { t, language } = useLanguage()
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [emailSent, setEmailSent] = useState(false)

  const handleSendReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const { error } = await resetPassword(email)
    setLoading(false)

    if (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, language) })
    } else {
      setEmailSent(true)
      setMessage({ type: 'success', text: t.message.resetSent })
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    const { error } = await updatePassword(newPassword)
    setLoading(false)

    if (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, language) })
    } else {
      setMessage({ type: 'success', text: t.message.passwordUpdated })
      setNewPassword('')
    }
  }

  if (type === 'recovery') {
    return (
      <div className="reset-card">
        <h2 className="reset-title">{t.reset.newTitle}</h2>
        <p className="reset-subtitle">{t.reset.newSubtitle}</p>

        <Message type={message.type} text={message.text} />

        <form className="reset-form" onSubmit={handleUpdatePassword}>
          <div className="form-field">
            <label className="form-label" htmlFor="new-password">{t.reset.newPassword}</label>
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
          <button className="btn-submit" type="submit" disabled={loading}>
            {loading ? t.reset.updating : t.reset.updatePassword}
          </button>
        </form>
      </div>
    )
  }

  if (emailSent) {
    return (
      <div className="reset-card">
        <div className="reset-success">
          <div className="reset-success-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="#3ecf8e" fillOpacity="0.15" />
              <path d="M16 24l6 6 10-12" stroke="#3ecf8e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="reset-title">{t.reset.checkEmail}</h2>
          <p className="reset-subtitle" dangerouslySetInnerHTML={{ __html: t.reset.emailSent.replace('{email}', email) }} />
        </div>
      </div>
    )
  }

  return (
    <div className="reset-card">
      <h2 className="reset-title">{t.reset.title}</h2>
      <p className="reset-subtitle">{t.reset.subtitle}</p>

      <Message type={message.type} text={message.text} />

      <form className="reset-form" onSubmit={handleSendReset}>
        <div className="form-field">
          <label className="form-label" htmlFor="reset-email">{t.auth.email}</label>
          <input
            id="reset-email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.auth.emailPlaceholder}
            required
          />
        </div>
        <button className="btn-submit" type="submit" disabled={loading}>
          {loading ? t.reset.sending : t.reset.sendResetLink}
        </button>
      </form>
    </div>
  )
}
