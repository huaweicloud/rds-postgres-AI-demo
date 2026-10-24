import { AuthProvider, useAuth } from './lib/auth'
import Auth from './components/Auth'
import ChatApp from './components/ChatApp'

function AppInner() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="center-screen">加载中...</div>
  }

  return session ? <ChatApp /> : <Auth />
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
