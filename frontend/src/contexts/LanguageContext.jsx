import { createContext, useContext, useState } from 'react'
import { translations } from '../i18n/translations.js'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(
    () => localStorage.getItem('smarthris_lang') || 'en'
  )

  function switchLanguage(lang) {
    localStorage.setItem('smarthris_lang', lang)
    setLanguage(lang)
  }

  const t = translations[language] ?? translations.en

  return (
    <LanguageContext.Provider value={{ language, setLanguage: switchLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
