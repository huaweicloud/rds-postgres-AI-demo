import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '缺少环境变量：请复制 .env.example 为 .env，并填入 RDS Supabase 项目的 URL 和 Anon Key',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 持久化会话，刷新页面后无需重新登录
    persistSession: true,
    autoRefreshToken: true,
  },
})
