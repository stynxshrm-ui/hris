import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, ChevronDown, User, Settings, LogOut, AlertCircle, Info } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { useLanguage } from '../../contexts/LanguageContext.jsx'

const NOTIFICATIONS = [
  {
    id: 1,
    icon: AlertCircle,
    color: 'text-red-500',
    message: '2 employees have overdue mandatory training',
    time: '2 hours ago',
  },
  {
    id: 2,
    icon: AlertCircle,
    color: 'text-orange-400',
    message: "Robert Kim's GDPR cert expires in 12 days",
    time: '5 hours ago',
  },
  {
    id: 3,
    icon: Info,
    color: 'text-blue-400',
    message: "James O'Connor transferred to Data & Analytics",
    time: 'Yesterday',
  },
]

export default function TopBar({ onMenuClick, notifCount }) {
  const navigate  = useNavigate()
  const auth      = useAuth()
  const { language, setLanguage, t } = useLanguage()

  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen,  setUserOpen]  = useState(false)
  const notifRef = useRef(null)
  const userRef  = useRef(null)

  useEffect(() => {
    function onMouseDown(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (userRef.current  && !userRef.current.contains(e.target))  setUserOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function handleSignOut() {
    auth.logout()
    navigate('/login', { replace: true })
  }

  function toggleLanguage() {
    setLanguage(language === 'en' ? 'sv' : 'en')
  }

  return (
    <header className="h-16 bg-slate-900 flex items-center justify-between px-4 shrink-0 border-b border-slate-800">

      {/* ── Left: hamburger + logo ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold tracking-tight">SH</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight select-none">
            Smart<span className="text-blue-400">HRIS</span>
          </span>
        </div>
      </div>

      {/* ── Right: language toggle + bell + user ───────────────────────── */}
      <div className="flex items-center gap-1">

        {/* Language toggle */}
        <button
          onClick={toggleLanguage}
          title={language === 'en' ? 'Switch to Swedish' : 'Byt till engelska'}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-base leading-none"
        >
          {language === 'en' ? '🇸🇪' : '🇬🇧'}
        </button>

        {/* Notification bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen(o => !o); setUserOpen(false) }}
            className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {notifCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-800">{t.topBar.notifications}</span>
                <button className="text-xs text-blue-600 hover:underline">{t.topBar.markAllRead}</button>
              </div>
              <ul>
                {NOTIFICATIONS.map(n => {
                  const Icon = n.icon
                  return (
                    <li
                      key={n.id}
                      className="flex gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <Icon size={16} className={clsx('shrink-0 mt-0.5', n.color)} />
                      <div>
                        <p className="text-sm text-slate-700 leading-snug">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div ref={userRef} className="relative">
          <button
            onClick={() => { setUserOpen(o => !o); setNotifOpen(false) }}
            className="flex items-center gap-2 ml-1 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
              AF
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-white leading-none">Amanda Foster</p>
              <p className="text-xs text-slate-400 mt-0.5">HR Admin</p>
            </div>
            <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1 overflow-hidden">
              <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                <User size={15} className="text-slate-400" /> My Profile
              </button>
              <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                <Settings size={15} className="text-slate-400" /> Settings
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} /> {t.buttons.signOut}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
