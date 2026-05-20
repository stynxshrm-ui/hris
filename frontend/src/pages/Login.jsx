import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useLanguage } from '../contexts/LanguageContext.jsx'

const LANG_OPTIONS = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'sv', label: 'Svenska', flag: '🇸🇪' },
]

export default function Login() {
  const navigate  = useNavigate()
  const auth      = useAuth()
  const { language, setLanguage, t } = useLanguage()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setTimeout(() => {
      const ok = auth.login(username.trim(), password)
      if (ok) {
        navigate('/dashboard', { replace: true })
      } else {
        setError(t.auth.invalidCredentials)
        setLoading(false)
      }
    }, 400)
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — dark navy ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-2/5 bg-slate-900 flex-col justify-between p-12">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold tracking-tight">SH</span>
          </div>
          <span className="text-white font-semibold text-xl tracking-tight">
            Smart<span className="text-blue-400">HRIS</span>
          </span>
        </div>

        {/* Central tagline */}
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              {t.auth.tagline}
            </h1>
            <p className="text-slate-400 mt-4 text-base leading-relaxed">
              Streamline HR operations with AI-powered insights, real-time compliance
              tracking, and unified workforce management.
            </p>
          </div>

          <ul className="space-y-4">
            {[
              'AI-powered workforce insights',
              'Real-time compliance tracking',
              'Smart learning & development',
              'Unified org management',
            ].map(item => (
              <li key={item} className="flex items-center gap-3 text-slate-300 text-sm">
                <span className="w-5 h-5 bg-blue-600/30 border border-blue-500/40 rounded-full flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 12 12" className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-slate-600 text-xs">
          © 2026 NordTech AB · SmartHRIS v1.0
        </p>
      </div>

      {/* ── Right panel — white form ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white">

        {/* Mobile logo */}
        <div className="flex lg:hidden items-center gap-2.5 mb-10">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-xs font-bold">SH</span>
          </div>
          <span className="text-slate-800 font-semibold text-lg">
            Smart<span className="text-blue-600">HRIS</span>
          </span>
        </div>

        <div className="w-full max-w-sm">

          {/* Language selector */}
          <div className="flex justify-end mb-8">
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer"
            >
              {LANG_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.flag} {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800">{t.auth.welcomeBack}</h2>
            <p className="text-slate-500 mt-1 text-sm">{t.auth.signInToAccount}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t.auth.username}
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t.auth.password}
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : null}
              {t.auth.signIn}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
