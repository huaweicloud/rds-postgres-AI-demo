import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { useNavigate } from 'react-router-dom'
import { useState, useMemo } from 'react'

export default function Dashboard() {
  const { user, session, signOut } = useAuth()
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)

  const meta = user?.user_metadata ?? {}
  const name = meta.full_name || meta.name || meta.user_name || t.githubUser
  const username = meta.user_name
  const avatar = meta.avatar_url
  const email = user?.email || meta.email

  const loginTime = useMemo(() => {
    const raw = session?.created_at || user?.created_at
    if (!raw) return '—'
    const d = new Date(raw)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }, [session?.created_at, user?.created_at, lang])

  const handleSignOut = async () => {
    setSigningOut(true)
    const ok = await signOut()
    setSigningOut(false)
    if (ok) navigate('/', { replace: true })
  }

  const copyToClipboard = async (text) => {
    if (!text) return false
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(textarea)
        return ok
      } catch {
        return false
      }
    }
  }

  const handleCopyToken = async () => {
    const token = session?.access_token
    if (!token) return
    const ok = await copyToClipboard(token)
    if (ok) {
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    }
  }

  const handleCopy = async (text) => {
    await copyToClipboard(text)
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <div className="dashboard-header-top">
            <h2 className="dashboard-theme">
              <span className="dashboard-theme-highlight">Supabase GitHub SSO</span>
            </h2>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="github-corner"
              aria-label="GitHub"
            >
              <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
            </a>
          </div>
          <p className="dashboard-welcome">
            {t.dashboardWelcome}
          </p>
        </header>

        <div className="profile">
          {avatar ? (
            <img className="avatar" src={avatar} alt={name} />
          ) : (
            <div className="avatar avatar-fallback">{name.charAt(0).toUpperCase()}</div>
          )}

          <div className="profile-info">
            <h3 className="profile-name">{name}</h3>
            {username && <p className="profile-username">@{username}</p>}
            {email && <p className="profile-email">{email}</p>}
          </div>
        </div>

        <div className="detail-list">
          <div className="detail-row" onClick={() => handleCopy(user?.id)}>
            <span className="detail-label">{t.userId}</span>
            <span className="detail-value" title={user?.id}>{user?.id ?? '—'}</span>
          </div>
          <div className="detail-row" onClick={() => handleCopy(email)}>
            <span className="detail-label">{t.email}</span>
            <span className="detail-value" title={email}>{email ?? '—'}</span>
          </div>
          <div className="detail-row detail-row-token">
            <span className="detail-label">{t.accessToken}</span>
            <div className="token-field">
              <input
                type="password"
                className="token-input"
                value={session?.access_token ?? ''}
                readOnly
              />
              <button
                type="button"
                className="token-copy-btn"
                onClick={handleCopyToken}
                disabled={!session?.access_token}
              >
                {tokenCopied ? t.copied : t.copyToken}
              </button>
            </div>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t.loginMethod}</span>
            <span className="detail-value">
              {user?.app_metadata?.provider ?? 'github'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">{t.loginTime}</span>
            <span className="detail-value">{loginTime}</span>
          </div>
          <div className="detail-row detail-row-logout">
            <button
              type="button"
              className="btn-logout"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? t.loggingOut : t.logout}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
