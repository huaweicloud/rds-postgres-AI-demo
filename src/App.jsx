import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LanguageProvider, useLang } from './context/LanguageContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

function LangSwitch() {
  const { lang, toggleLang } = useLang()
  return (
    <button className="lang-switch" onClick={toggleLang} aria-label="Switch language">
      {lang === 'zh' ? 'EN' : '中'}
    </button>
  )
}

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const { t } = useLang()

  if (loading) {
    return (
      <div className="full-center">
        <span className="spinner spinner-lg" />
        <p>{t.loadingSession}</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/" replace />
  }

  return children
}

function RootRoute() {
  const { session, loading } = useAuth()
  const { t } = useLang()

  if (loading) {
    return (
      <div className="full-center">
        <span className="spinner spinner-lg" />
        <p>{t.loadingSession}</p>
      </div>
    )
  }

  if (session) {
    return <Navigate to="/demo" replace />
  }

  return <Login />
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <LangSwitch />
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route
            path="/demo"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </LanguageProvider>
  )
}
