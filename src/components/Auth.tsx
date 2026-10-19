import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup'

export default function Auth() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } }, // 触发器读取该字段创建 profile
        })
        if (error) throw error
        setError('注册成功，请前往邮箱完成验证后登录。')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>RDS Supabase 实时聊天</h1>
        <p className="auth-subtitle">
          {mode === 'login' ? '登录以继续' : '创建新账号'}
        </p>

        {mode === 'signup' && (
          <label>
            用户名
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="将在聊天中展示"
              required
              minLength={1}
              maxLength={30}
            />
          </label>
        )}

        <label>
          邮箱
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label>
          密码
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位"
            required
            minLength={6}
          />
        </label>

        {error && <div className="form-error">{error}</div>}

        <button type="submit" disabled={busy}>
          {busy ? '请稍候...' : mode === 'login' ? '登录' : '注册'}
        </button>

        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError(null)
          }}
        >
          {mode === 'login' ? '没有账号？立即注册' : '已有账号？返回登录'}
        </button>
      </form>
    </div>
  )
}
