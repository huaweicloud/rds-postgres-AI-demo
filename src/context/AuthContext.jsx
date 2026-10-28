import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    // 初始化时获取当前会话
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        setError(error.message)
      } else {
        setSession(data.session)
      }
      setLoading(false)
    })

    // 监听认证状态变化
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setError(null)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // 使用 GitHub OAuth 登录
  const signInWithGitHub = useCallback(async () => {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) {
      setError(error.message)
      return false
    }
    return true
  }, [])

  // 登出
  const signOut = useCallback(async () => {
    setError(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setError(error.message)
      return false
    }
    setSession(null)
    return true
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    error,
    signInWithGitHub,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用')
  }
  return ctx
}
