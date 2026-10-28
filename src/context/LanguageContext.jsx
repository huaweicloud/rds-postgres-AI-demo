import { createContext, useContext, useState } from 'react'
import zh from '../i18n/zh'
import en from '../i18n/en'

const translations = { zh, en }
const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('zh')

  const t = translations[language]
  const toggleLanguage = () => setLanguage(prev => prev === 'zh' ? 'en' : 'zh')

  return (
    <LanguageContext.Provider value={{ language, t, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
