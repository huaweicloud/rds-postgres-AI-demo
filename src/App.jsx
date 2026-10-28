import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LanguageProvider, useLanguage } from './context/LanguageContext'
import AuthForm from './components/AuthForm'
import Dashboard from './components/Dashboard'
import ResetPassword from './components/ResetPassword'

function LanguageSwitch() {
  const { language, toggleLanguage } = useLanguage()
  return (
    <button className="lang-switch" onClick={toggleLanguage}>
      {language === 'zh' ? 'EN' : '中'}
    </button>
  )
}

function AppContent() {
  const { user, loading, isPasswordRecovery } = useAuth()
  const { t } = useLanguage()
  const [showReset, setShowReset] = useState(false)

  if (loading) {
    return (
      <div className="app-wrapper">
        <LanguageSwitch />
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>{t.common.loading}</p>
        </div>
      </div>
    )
  }

  if (isPasswordRecovery) {
    return (
      <div className="app-wrapper">
        <LanguageSwitch />
        <ResetPassword type="recovery" />
      </div>
    )
  }

  if (user) {
    return (
      <div className="app-wrapper">
        <LanguageSwitch />
        <Dashboard />
      </div>
    )
  }

  if (showReset) {
    return (
      <div className="app-wrapper">
        <LanguageSwitch />
        <ResetPassword type="request" />
        <button className="back-link" onClick={() => setShowReset(false)}>
          {t.common.backToSignIn}
        </button>
      </div>
    )
  }

  return (
    <div className="app-wrapper">
      <LanguageSwitch />
      <AuthForm />
      <button className="forgot-link" onClick={() => setShowReset(true)}>
        {t.auth.forgotPassword}
      </button>
    </div>
  )
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  )
}
