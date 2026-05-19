import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Sparkles } from 'lucide-react'

const WELCOME = "Hello! I'm SmartHRIS Assistant. Ask me anything about employees, training status, compliance alerts, or department headcount."

const SUGGESTIONS = [
  'How many active employees are in Engineering?',
  'Show overdue mandatory training',
  "What's Aisha Patel's training status?",
  'Give me a headcount breakdown by department',
]

function Message({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={15} className="text-white" />
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-700 rounded-bl-sm'
        }`}
      >
        {content}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
        <Bot size={15} className="text-white" />
      </div>
      <div className="bg-slate-100 px-4 py-3.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
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

export default function AIAssistant() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: WELCOME }])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [history,  setHistory]  = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(text) {
    const msg = text ?? input
    if (!msg.trim() || loading) return
    setInput('')

    const userMsg = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chat`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ message: msg, conversationHistory: history }),
        }
      )
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Request failed')

      // Format the structured response for display
      const reply = formatResponse(json.response)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      setHistory(json.cleanHistory ?? [])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Sorry, something went wrong: ${err.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const showSuggestions = messages.length === 1 && !loading

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4" style={{ height: 'calc(100vh - 160px)' }}>

      {/* Page header */}
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
          {messages.map((m, i) => <Message key={i} role={m.role} content={m.content} />)}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts */}
        {showSuggestions && (
          <div className="px-5 pb-3">
            <p className="text-xs text-slate-400 mb-2">Try asking…</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-slate-100 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask about employees, training, compliance…"
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Render the structured JSON response as readable text ──────────────────────
function formatResponse(response) {
  if (!response || typeof response !== 'object') return String(response)

  const { type, data } = response

  if (type === 'summary' || type === 'text') {
    if (data?.explanation) return data.explanation
    if (typeof data === 'string') return data
    return JSON.stringify(data, null, 2)
  }

  if (type === 'table' && Array.isArray(data)) {
    if (data.length === 0) return 'No results found.'
    return data
      .map(row => Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(' · '))
      .join('\n')
  }

  if (type === 'alert_list') {
    const overdue  = data?.overdue_mandatory_training ?? []
    const expiring = data?.expiring_certifications    ?? []
    const lines = []
    if (overdue.length)  lines.push(`Overdue training (${overdue.length}): ${overdue.map(a => a.employee_name).join(', ')}`)
    if (expiring.length) lines.push(`Expiring certs (${expiring.length}): ${expiring.map(a => a.employee_name).join(', ')}`)
    return lines.join('\n') || 'No alerts found.'
  }

  return JSON.stringify(data, null, 2)
}
