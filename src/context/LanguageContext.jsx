import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { translations } from '../i18n'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('app-lang')
    return saved === 'en' ? 'en' : 'zh'
  })

  useEffect(() => {
    localStorage.setItem('app-lang', lang)
  }, [lang])

  const toggleLang = useCallback(() => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'))
  }, [])

  const t = translations[lang]

  const value = { lang, toggleLang, t }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (ctx === null) {
    throw new Error('useLang must be used within LanguageProvider')
  }
  return ctx
}
