export const translations = {
  zh: {
    // Login page
    loginSubtitle: '使用 GitHub 账号登录以继续',
    loginButton: '使用 GitHub 登录',
    loginPending: '正在跳转 GitHub...',
    flowTitle: 'SSO 认证流程',
    flowStep1Title: '发起授权',
    flowStep1Desc: '点击登录后，应用通过 Supabase 向 GitHub OAuth 发起授权请求',
    flowStep2Title: 'GitHub 授权',
    flowStep2Desc: '跳转至 GitHub 页面，由您确认授权应用访问您的账号信息',
    flowStep3Title: '回调换令牌',
    flowStep3Desc: 'GitHub 授权后携带 code 回调本应用，Supabase 用 code 换取 Access Token',
    flowStep4Title: '建立会话',
    flowStep4Desc: 'Supabase 创建用户会话，自动返回本应用并完成登录',

    // Dashboard
    dashboardWelcome: '登录成功，欢迎您体验RDS AI应用开发平台',
    userId: '用户 ID',
    email: '邮箱',
    accessToken: 'Access Token',
    copyToken: '点击复制',
    copied: '已复制',
    loginMethod: '登录方式',
    loginTime: '登录时间',
    logout: '退出登录',
    loggingOut: '登出中...',
    githubUser: 'GitHub 用户',

    // App loading
    loadingSession: '正在加载会话...',
  },
  en: {
    // Login page
    loginSubtitle: 'Sign in with your GitHub account to continue',
    loginButton: 'Sign in with GitHub',
    loginPending: 'Redirecting to GitHub...',
    flowTitle: 'SSO Authentication Flow',
    flowStep1Title: 'Initiate Auth',
    flowStep1Desc: 'After clicking, the app sends an OAuth request to GitHub via Supabase',
    flowStep2Title: 'GitHub Authorize',
    flowStep2Desc: 'Redirect to GitHub where you authorize the app to access your account',
    flowStep3Title: 'Callback & Token',
    flowStep3Desc: 'GitHub redirects back with a code, Supabase exchanges it for an Access Token',
    flowStep4Title: 'Establish Session',
    flowStep4Desc: 'Supabase creates a user session and returns to the app, completing login',

    // Dashboard
    dashboardWelcome: 'Login successful, welcome to RDS AI Application Development Platform',
    userId: 'User ID',
    email: 'Email',
    accessToken: 'Access Token',
    copyToken: 'Copy',
    copied: 'Copied',
    loginMethod: 'Login Method',
    loginTime: 'Login Time',
    logout: 'Sign Out',
    loggingOut: 'Signing out...',
    githubUser: 'GitHub User',

    // App loading
    loadingSession: 'Loading session...',
  },
}
