import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import Message from './Message'
import { getErrorMessage } from '../lib/errors'

function getPasswordStrength(password) {
  if (!password) return { level: 0, label: '' }
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return { level: 1, label: 'weak' }
  if (score <= 3) return { level: 2, label: 'medium' }
  return { level: 3, label: 'strong' }
}

export default function AuthForm() {
  const { signUp, signIn, sendMagicLink } = useAuth()
  const { t, language } = useLanguage()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const strength = getPasswordStrength(password)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    if (mode === 'magiclink') {
      const { error } = await sendMagicLink(email)
      setLoading(false)

      if (error) {
        setMessage({ type: 'error', text: getErrorMessage(error, language) })
      } else {
        setSentEmail(email)
        setMagicLinkSent(true)
        setMessage({ type: 'success', text: t.message.magicLinkSent })
        setEmail('')
      }
      return
    }

    const action = mode === 'signin' ? signIn : signUp
    const { data, error } = await action(email, password)

    setLoading(false)

    if (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, language) })
      return
    }

    if (mode === 'signup' && data.user && !data.session) {
      setMessage({ type: 'success', text: t.message.signUpSuccess })
      setEmail('')
      setPassword('')
    } else {
      setMessage({ type: 'success', text: mode === 'signin' ? t.message.signInSuccess : t.message.signUpCreated })
    }
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setMessage({ type: '', text: '' })
    setMagicLinkSent(false)
    setSentEmail('')
  }

  const showPasswordField = mode !== 'magiclink'

  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="auth-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="url(#grad)" />
            <path d="M12 20l6 6 10-12" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40">
                <stop stopColor="#3ecf8e" />
                <stop offset="1" stopColor="#1a7f5a" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h1 className="auth-title">{t.auth.title}</h1>
        <p className="auth-subtitle">{t.auth.subtitle}</p>
      </div>

      <div className="auth-tabs">
        <button
          className={`auth-tab ${mode === 'signin' ? 'auth-tab--active' : ''}`}
          onClick={() => switchMode('signin')}
        >
          {t.auth.signIn}
        </button>
        <button
          className={`auth-tab ${mode === 'signup' ? 'auth-tab--active' : ''}`}
          onClick={() => switchMode('signup')}
        >
          {t.auth.signUp}
        </button>
        <button
          className={`auth-tab ${mode === 'magiclink' ? 'auth-tab--active' : ''}`}
          onClick={() => switchMode('magiclink')}
        >
          {t.auth.magicLink}
        </button>
      </div>

      <Message type={message.type} text={message.text} />

      {magicLinkSent ? (
        <div className="magic-link-success">
          <div className="magic-link-success-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="#3ecf8e" fillOpacity="0.15" />
              <path d="M16 24l6 6 10-12" stroke="#3ecf8e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="magic-link-success-title">{t.reset.checkEmail}</h2>
          <p className="magic-link-success-subtitle" dangerouslySetInnerHTML={{ __html: t.reset.magicLinkEmailSent.replace('{email}', sentEmail) }} />
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="email">{t.auth.email}</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.auth.emailPlaceholder}
              required
            />
          </div>

          {showPasswordField && (
            <div className="form-field">
              <label className="form-label" htmlFor="password">{t.auth.password}</label>
              <input
                id="password"
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.auth.passwordPlaceholder}
                minLength={6}
                required
              />
              {mode === 'signup' && password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div
                      className={`strength-fill strength-${strength.label}`}
                      style={{ width: `${strength.level * 33.33}%` }}
                    />
                  </div>
                  <span className={`strength-label strength-label-${strength.label}`}>
                    {t.password[strength.label]}
                  </span>
                </div>
              )}
            </div>
          )}

          <button className="btn-submit" type="submit" disabled={loading}>
            {loading
              ? t.auth.processing
              : mode === 'signin'
                ? t.auth.signIn
                : mode === 'signup'
                  ? t.auth.createAccount
                  : t.auth.magicLink + ' 登录'}
          </button>
        </form>
      )}
    </div>
  )
}
