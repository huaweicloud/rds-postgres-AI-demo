import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Message from './Message'
import { getErrorMessage } from '../lib/errors'

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export default function ChangeEmail({ onCancel }) {
  const { user, updateEmail } = useAuth()
  const { t, language } = useLanguage()
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    if (newEmail.trim().toLowerCase() === user.email?.toLowerCase()) {
      setMessage({ type: 'error', text: t.changeEmail.sameEmail })
      return
    }

    setLoading(true)
    let result
    try {
      result = await withTimeout(updateEmail(newEmail.trim()), 15000)
    } catch {
      result = { error: { message: 'timeout' } }
    }
    setLoading(false)

    const { error } = result
    if (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, language) })
    } else {
      setMessage({ type: 'success', text: t.changeEmail.success })
      setNewEmail('')
    }
  }

  return (
    <div className="change-email-section">
      <h2 className="change-email-title">{t.changeEmail.title}</h2>
      <p className="change-email-subtitle">{t.changeEmail.subtitle}</p>

      <Message type={message.type} text={message.text} />

      <form className="change-email-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label" htmlFor="new-email">{t.changeEmail.newEmail}</label>
          <input
            id="new-email"
            type="email"
            className="form-input"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder={t.changeEmail.newEmailPlaceholder}
            required
          />
        </div>
        <div className="change-email-actions">
          <button className="btn-submit" type="submit" disabled={loading}>
            {loading ? t.changeEmail.sending : t.changeEmail.submit}
          </button>
          <button className="btn-cancel" type="button" onClick={onCancel} disabled={loading}>
            {t.changeEmail.cancel}
          </button>
        </div>
      </form>
    </div>
  )
}
