import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'

export default function Login() {
  const { signInWithGitHub, error } = useAuth()
  const { t } = useLang()
  const [pending, setPending] = useState(false)

  const handleGitHubLogin = async () => {
    setPending(true)
    await signInWithGitHub()
    setPending(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true">
            <path
              fill="#1f2937"
              d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.36 9.36 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"
            />
          </svg>
        </div>
        <h1 className="auth-title">
          <span className="auth-title-highlight">Supabase GitHub SSO</span>
        </h1>
        <p className="auth-subtitle">{t.loginSubtitle}</p>

        <button
          type="button"
          className="btn-github"
          onClick={handleGitHubLogin}
          disabled={pending}
        >
          {pending ? (
            <>
              <span className="spinner" aria-hidden="true" />
              {t.loginPending}
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
              {t.loginButton}
            </>
          )}
        </button>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <div className="auth-flow">
          <p className="auth-flow-title">{t.flowTitle}</p>
          <ol className="auth-flow-steps">
            <li>
              <span className="auth-flow-step-num">1</span>
              <div className="auth-flow-step-content">
                <strong>{t.flowStep1Title}</strong>
                <span>{t.flowStep1Desc}</span>
              </div>
            </li>
            <li>
              <span className="auth-flow-step-num">2</span>
              <div className="auth-flow-step-content">
                <strong>{t.flowStep2Title}</strong>
                <span>{t.flowStep2Desc}</span>
              </div>
            </li>
            <li>
              <span className="auth-flow-step-num">3</span>
              <div className="auth-flow-step-content">
                <strong>{t.flowStep3Title}</strong>
                <span>{t.flowStep3Desc}</span>
              </div>
            </li>
            <li>
              <span className="auth-flow-step-num">4</span>
              <div className="auth-flow-step-content">
                <strong>{t.flowStep4Title}</strong>
                <span>{t.flowStep4Desc}</span>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  )
}
