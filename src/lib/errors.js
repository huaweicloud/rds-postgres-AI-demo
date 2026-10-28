const errorMessages = {
  zh: {
    'Invalid login credentials': '登录凭证无效，请检查邮箱和密码',
    'Email not confirmed': '邮箱未确认，请先确认您的邮箱',
    'User already registered': '该邮箱已注册',
    'Password should be at least 6 characters': '密码至少6位字符',
    'Unable to validate email address: invalid format': '邮箱格式无效',
    'rate_limit_exceeded': '请求过于频繁，请稍后重试',
    'timeout': '请求超时或服务不可用，请检查网络后重试',
    'default': '操作失败，请重试',
  },
  en: {
    'Invalid login credentials': 'Invalid login credentials',
    'Email not confirmed': 'Email not confirmed. Please verify your email first',
    'User already registered': 'This email is already registered',
    'Password should be at least 6 characters': 'Password must be at least 6 characters',
    'Unable to validate email address: invalid format': 'Invalid email format',
    'rate_limit_exceeded': 'Too many requests. Please try again later',
    'timeout': 'Request timed out or service unavailable. Please check your network and retry',
    'default': 'Operation failed. Please try again',
  },
}

export function getErrorMessage(error, language = 'zh') {
  if (!error) return ''
  
  const message = error.message || 'default'
  const translations = errorMessages[language] || errorMessages.zh
  
  return translations[message] || translations.default
}
