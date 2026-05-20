import { useState, useRef, useEffect } from 'react'
import {
  Send, Bot, Sparkles, AlertTriangle, CheckCircle, Info,
  Users, BookOpen, Clock, ChevronRight,
} from 'lucide-react'
import { sendChat } from '../services/api'
import { useToast } from '../components/ui/Toaster.jsx'

// ── Suggested prompts ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { label: 'Who is overdue on compliance training',    icon: AlertTriangle },
  { label: 'Summarise headcount by department',        icon: Users },
  { label: 'Show me new hires this month',             icon: BookOpen },
  { label: 'Run the department transfer for employee E007', icon: ChevronRight },
]

const WELCOME = "Hello! I'm the SmartHRIS AI Assistant. Ask me anything about employees, training, compliance alerts, or department headcount."

// ── AIResponseRenderer ────────────────────────────────────────────────────────
// Inspects `type` and renders the right UI component.
function AIResponseRenderer({ response }) {
  if (!response || typeof response !== 'object') {
    return <p className="text-sm text-slate-700 leading-relaxed">{String(response)}</p>
  }

  const { type, data } = response

  // ── text / summary ────────────────────────────────────────────────────────
  if (type === 'text' || type === 'summary') {
    if (typeof data === 'string') {
      return <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{data}</p>
    }

    if (typeof data === 'object' && data !== null) {
      const { explanation, content, ...rest } = data
      const intro = explanation ?? content ?? null

      // Partition remaining fields into arrays (render as sub-tables) and scalars
      const arrayFields  = Object.entries(rest).filter(([, v]) => Array.isArray(v) && v.length > 0)
      const scalarFields = Object.entries(rest).filter(([, v]) => !Array.isArray(v) && typeof v !== 'object')
      const objectFields = Object.entries(rest).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))

      const hasExtra = arrayFields.length || scalarFields.length || objectFields.length

      if (!intro && !hasExtra) {
        return <p className="text-sm text-slate-500 italic">No content.</p>
      }

      return (
        <div className="space-y-3">
          {intro && (
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{intro}</p>
          )}

          {/* Arrays → compact sub-tables */}
          {arrayFields.map(([key, rows]) => {
            const cols = Object.keys(rows[0] ?? {})
            return (
              <div key={key}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {key.replace(/_/g, ' ')}
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {cols.map(col => (
                          <th key={col} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                            {col.replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          {cols.map(col => (
                            <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                              {row[col] == null ? '—' : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {/* Nested objects → key-value grid */}
          {objectFields.map(([key, obj]) => (
            <div key={key}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {key.replace(/_/g, ' ')}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {Object.entries(obj).map(([k, v]) => (
                  <div key={k} className="flex gap-1.5 text-sm">
                    <span className="font-medium text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-slate-700">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Scalar fields */}
          {scalarFields.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {scalarFields.map(([k, v]) => (
                <div key={k} className="flex gap-1.5 text-sm">
                  <span className="font-medium text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                  <span className="text-slate-700">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return <p className="text-sm text-slate-500 italic">No content.</p>
  }

  // ── table ─────────────────────────────────────────────────────────────────
  if (type === 'table') {
    const rows = Array.isArray(data) ? data : []
    if (rows.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-slate-500 italic">
          <Info size={14} /> No results found.
        </div>
      )
    }
    const cols = Object.keys(rows[0])
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {cols.map(col => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
              >
                {cols.map(col => (
                  <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {row[col] == null ? '—' : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── alert_list ────────────────────────────────────────────────────────────
  if (type === 'alert_list') {
    const overdue  = data?.overdue_mandatory_training ?? []
    const expiring = data?.expiring_certifications    ?? []
    const isEmpty  = overdue.length === 0 && expiring.length === 0

    if (isEmpty) {
      return (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle size={15} />
          <span>No compliance alerts — all clear!</span>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {overdue.length > 0 && (
          <AlertSection
            icon={AlertTriangle}
            iconCls="text-red-500"
            headerCls="bg-red-50 border-red-200"
            title={`Overdue Training (${overdue.length})`}
            items={overdue}
            renderItem={a => ({
              primary: a.employee_name,
              secondary: `${a.course_name} · ${a.days_overdue}d overdue`,
              badge: `${a.days_overdue}d`,
              badgeCls: 'bg-red-100 text-red-700',
            })}
          />
        )}
        {expiring.length > 0 && (
          <AlertSection
            icon={Clock}
            iconCls="text-amber-500"
            headerCls="bg-amber-50 border-amber-200"
            title={`Expiring Certifications (${expiring.length})`}
            items={expiring}
            renderItem={a => ({
              primary: a.employee_name,
              secondary: `${a.certification_name} · expires ${a.expiry_date}`,
              badge: `${a.days_until_expiry}d`,
              badgeCls: 'bg-amber-100 text-amber-700',
            })}
          />
        )}
      </div>
    )
  }

  // ── transfer_result ───────────────────────────────────────────────────────
  if (type === 'transfer_result') {
    const { employee, transfer, diff } = data ?? {}
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <CheckCircle size={15} className="text-emerald-500" />
          <span>Transfer complete for <strong>{employee?.name}</strong></span>
        </div>
        {transfer && (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
            <span className="px-2 py-0.5 bg-slate-200 rounded text-xs">{transfer.from?.name}</span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{transfer.to?.name}</span>
          </div>
        )}
        {diff && (
          <div className="grid grid-cols-2 gap-2">
            {diff.toUnenroll?.length > 0 && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-2.5">
                <p className="text-xs font-semibold text-red-600 mb-1.5">
                  Unenroll ({diff.toUnenroll.length})
                </p>
                {diff.toUnenroll.map((c, i) => (
                  <p key={i} className="text-xs text-red-700 truncate">— {c.title ?? c.course_id}</p>
                ))}
              </div>
            )}
            {diff.toEnroll?.length > 0 && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5">
                <p className="text-xs font-semibold text-emerald-600 mb-1.5">
                  Enroll ({diff.toEnroll.length})
                </p>
                {diff.toEnroll.map((c, i) => (
                  <p key={i} className="text-xs text-emerald-700 truncate">+ {c.title ?? c.course_id}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── fallback: raw JSON ────────────────────────────────────────────────────
  return (
    <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

// Shared section component for alert_list groups
function AlertSection({ icon: Icon, iconCls, headerCls, title, items, renderItem }) {
  return (
    <div className={`rounded-lg border ${headerCls} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${headerCls}`}>
        <Icon size={13} className={iconCls} />
        <span className="text-xs font-semibold text-slate-700">{title}</span>
      </div>
      <div className="divide-y divide-slate-100 bg-white">
        {items.map((item, i) => {
          const { primary, secondary, badge, badgeCls } = renderItem(item)
          return (
            <div key={i} className="flex items-center justify-between px-3 py-2 gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{primary}</p>
                <p className="text-xs text-slate-500 truncate">{secondary}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeCls}`}>
                {badge}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Message({ role, response, rawContent }) {
  const isUser = role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={15} className="text-white" />
        </div>
      )}
      <div
        className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-700 rounded-bl-sm'
        }`}
      >
        {isUser
          ? <p className="leading-relaxed">{rawContent}</p>
          : <AIResponseRenderer response={response} />
        }
      </div>
    </div>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
        <Bot size={15} className="text-white" />
      </div>
      <div className="bg-slate-100 px-4 py-3.5 rounded-2xl rounded-bl-sm flex gap-1.5 items-center">
        {[0, 150, 300].map(delay => (
          <span
            key={delay}
            className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const toast = useToast()
  const [messages, setMessages] = useState([
    { role: 'assistant', response: { type: 'text', data: { content: WELCOME } } },
  ])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(text) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setError(null)

    setMessages(prev => [...prev, { role: 'user', rawContent: msg }])
    setLoading(true)

    try {
      const json = await sendChat(msg, history)

      // Normalise: ensure response is a proper object
      let response = json.response
      if (!response || typeof response !== 'object') {
        response = { type: 'text', data: { content: String(response) } }
      }

      setMessages(prev => [...prev, { role: 'assistant', response }])
      setHistory(json.cleanHistory ?? [])
    } catch (err) {
      toast.error(err.message)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          response: {
            type: 'text',
            data: { content: `Sorry, something went wrong: ${err.message}` },
          },
        },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const showSuggestions = messages.length === 1 && !loading

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4" style={{ height: 'calc(100vh - 160px)' }}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Sparkles size={22} className="text-blue-500" /> AI Assistant
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Ask natural-language questions about employees, training, and compliance
        </p>
      </div>

      {/* Chat card */}
      <div className="flex flex-col flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-0">

        {/* Messages */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <Message
              key={i}
              role={m.role}
              response={m.response}
              rawContent={m.rawContent}
            />
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Suggestion chips — only shown on welcome screen */}
        {showSuggestions && (
          <div className="px-5 pb-3">
            <p className="text-xs text-slate-400 mb-2">Try asking…</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => handleSend(label)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-slate-100 p-4">
          <form
            onSubmit={e => { e.preventDefault(); handleSend() }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about employees, training, compliance…"
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
