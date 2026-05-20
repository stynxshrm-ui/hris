import { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

// ── Context ───────────────────────────────────────────────────────────────────

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

let _nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const add = useCallback((type, message, duration = 4500) => {
    const id = ++_nextId
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const toast = {
    error:   (msg, dur) => add('error',   msg, dur),
    success: (msg, dur) => add('success', msg, dur),
    info:    (msg, dur) => add('info',    msg, dur),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastList toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

// ── Toast list ────────────────────────────────────────────────────────────────

const VARIANT = {
  error:   {
    Icon: AlertCircle,
    wrap: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    text: 'text-red-800',
  },
  success: {
    Icon: CheckCircle,
    wrap: 'bg-emerald-50 border-emerald-200',
    icon: 'text-emerald-500',
    text: 'text-emerald-800',
  },
  info: {
    Icon: Info,
    wrap: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-500',
    text: 'text-blue-800',
  },
}

function ToastList({ toasts, dismiss }) {
  if (!toasts.length) return null
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map(t => {
        const v = VARIANT[t.type] ?? VARIANT.info
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto ${v.wrap}`}
          >
            <v.Icon size={16} className={`${v.icon} shrink-0 mt-0.5`} />
            <p className={`text-sm flex-1 leading-snug ${v.text}`}>{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className={`${v.icon} hover:opacity-70 transition-opacity shrink-0`}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
