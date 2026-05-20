import { useState, useEffect, useMemo } from 'react'
import {
  ShieldAlert, Clock, Bell, CheckCircle2, X, RefreshCw,
  AlertTriangle, Info, Filter,
} from 'lucide-react'
import { getCompliance } from '../services/api'
import { useToast } from '../components/ui/Toaster.jsx'
import { useLanguage } from '../contexts/LanguageContext.jsx'

// ── Primitives ────────────────────────────────────────────────────────────────

function Bone({ className }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-pink-500',  'bg-cyan-500',   'bg-indigo-500',  'bg-teal-500',
]
function avatarColor(name = '') {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name = '') {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase()
}
function Avatar({ name }) {
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColor(name)}`}>
      {initials(name)}
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Severity config ───────────────────────────────────────────────────────────

const SEV = {
  critical: {
    Icon:      ShieldAlert,
    headerCls: 'bg-red-50 border-red-200 text-red-700',
    borderCls: 'border-l-4 border-l-red-500',
    badgeCls:  'bg-red-100 text-red-700',
    dotCls:    'bg-red-500',
  },
  warning: {
    Icon:      AlertTriangle,
    headerCls: 'bg-amber-50 border-amber-200 text-amber-700',
    borderCls: 'border-l-4 border-l-amber-400',
    badgeCls:  'bg-amber-100 text-amber-700',
    dotCls:    'bg-amber-400',
  },
  info: {
    Icon:      Info,
    headerCls: 'bg-blue-50 border-blue-200 text-blue-700',
    borderCls: 'border-l-4 border-l-blue-400',
    badgeCls:  'bg-blue-100 text-blue-700',
    dotCls:    'bg-blue-400',
  },
}

function severityOf(alert) {
  if (alert.type === 'overdue') {
    return alert.daysOverdue > 14 ? 'critical' : 'warning'
  }
  if (alert.daysUntilExpiry <= 0)  return 'critical'
  if (alert.daysUntilExpiry <= 14) return 'warning'
  return 'info'
}

// ── Normalize API data into unified alert shape ───────────────────────────────

function normalizeAlerts(data) {
  const overdue = (data?.overdue_mandatory_training ?? []).map(r => ({
    id:              `${r.employee_id}_${r.course_id}_overdue`,
    type:            'overdue',
    label:           'Mandatory Training Overdue',
    employeeId:      r.employee_id,
    employeeName:    r.employee_name,
    department:      r.department,
    jobTitle:        r.job_title,
    courseName:      r.course_title,
    dueDate:         r.due_date,
    daysOverdue:     r.days_overdue,
    daysUntilExpiry: null,
  }))

  const expiring = (data?.expiring_certifications ?? []).map(r => ({
    id:              r.certification_id ?? `${r.employee_id}_${r.course_id}_cert`,
    type:            'expiring',
    label:           'Certification Expiring',
    employeeId:      r.employee_id,
    employeeName:    r.employee_name,
    department:      r.department,
    jobTitle:        r.job_title,
    courseName:      r.course_title,
    dueDate:         r.expiry_date,
    daysOverdue:     null,
    daysUntilExpiry: r.days_until_expiry,
  }))

  return [...overdue, ...expiring].map(a => ({ ...a, severity: severityOf(a) }))
}

// ── Reminder email builder ────────────────────────────────────────────────────

function buildEmail(alert) {
  const isOverdue = alert.type === 'overdue'
  const dateStr   = fmtDate(alert.dueDate)
  const urgency   = isOverdue
    ? `Our records show that "${alert.courseName}" was due on ${dateStr} and is now ${alert.daysOverdue} days overdue. This is a mandatory compliance requirement.`
    : `Your certification "${alert.courseName}" is scheduled to expire on ${dateStr} (${alert.daysUntilExpiry} days remaining).`

  return `Dear ${alert.employeeName},

I hope this message finds you well. I'm writing regarding an outstanding ${isOverdue ? 'training requirement' : 'certification renewal'} on your compliance record.

${urgency}

${isOverdue
    ? 'Please log in to the SmartHRIS Learning Portal and complete the required course at your earliest convenience to restore your compliance standing.'
    : 'To avoid a lapse in certification, please begin the renewal process before the expiry date. Log in to the SmartHRIS Learning Portal for next steps.'
}

If you have already completed this ${isOverdue ? 'training' : 'renewal'} or believe this message was sent in error, please reply so we can update your records.

Thank you for your prompt attention.

Best regards,
Amanda Foster
HR Administrator — NordTech AB`
}

// ── Reminder Modal ────────────────────────────────────────────────────────────

function ReminderModal({ alert, onClose }) {
  const { t }  = useLanguage()
  const [body,    setBody]    = useState(() => buildEmail(alert))
  const [sent,    setSent]    = useState(false)
  const [sending, setSending] = useState(false)

  function handleSend() {
    setSending(true)
    setTimeout(() => { setSending(false); setSent(true) }, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={!sending ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col overflow-hidden max-h-[90vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={17} className="text-blue-500" />
            <h2 className="font-semibold text-slate-800">{t.compliance.sendReminderTitle}</h2>
          </div>
          {!sending && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        {sent ? (
          <div className="px-6 py-10 flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <p className="font-semibold text-slate-800">{t.compliance.reminderSent}</p>
            <p className="text-sm text-slate-500 text-center">
              {t.compliance.emailDeliveredTo} <span className="font-medium">{alert.employeeName}</span>
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              {t.buttons.done}
            </button>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0 space-y-1 text-sm">
              <p className="text-slate-500">
                <span className="font-medium text-slate-700">To: </span>
                {alert.employeeName} · {alert.department}
              </p>
              <p className="text-slate-500">
                <span className="font-medium text-slate-700">Re: </span>
                {alert.label} — {alert.courseName}
              </p>
            </div>

            <div className="px-6 py-4 flex-1 overflow-y-auto">
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={sending}
                rows={14}
                className="w-full text-sm text-slate-700 leading-relaxed border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50 font-mono"
              />
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button
                onClick={onClose}
                disabled={sending}
                className="flex-1 py-2.5 text-sm font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {t.buttons.cancel}
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending
                  ? <><RefreshCw size={14} className="animate-spin" /> {t.buttons.sending}</>
                  : <><Bell size={14} /> {t.buttons.sendReminder}</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({ alert, resolving, onRemind, onResolve }) {
  const { t } = useLanguage()
  const sev = SEV[alert.severity]

  const timeLabel = alert.type === 'overdue'
    ? `${alert.daysOverdue}d overdue · due ${fmtDate(alert.dueDate)}`
    : alert.daysUntilExpiry <= 0
      ? `Expired ${fmtDate(alert.dueDate)}`
      : `Expires ${fmtDate(alert.dueDate)} · ${alert.daysUntilExpiry}d remaining`

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${sev.borderCls} p-4 transition-all duration-300 ${
      resolving ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
    }`}>
      <div className="flex items-start gap-3">
        <Avatar name={alert.employeeName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm">{alert.employeeName}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sev.badgeCls}`}>
              {alert.label}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{alert.department}{alert.jobTitle ? ` · ${alert.jobTitle}` : ''}</p>
          <p className="text-sm text-slate-600 mt-2 font-medium leading-snug">"{alert.courseName}"</p>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <Clock size={11} /> {timeLabel}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
        <button
          onClick={() => onRemind(alert)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Bell size={12} /> {t.buttons.sendReminder}
        </button>
        <button
          onClick={() => onResolve(alert.id)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
        >
          <CheckCircle2 size={12} /> {t.buttons.markResolved}
        </button>
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ severity, alerts, resolving, onRemind, onResolve }) {
  const { t } = useLanguage()
  if (alerts.length === 0) return null
  const { Icon, headerCls } = SEV[severity]

  return (
    <div>
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border mb-3 ${headerCls}`}>
        <Icon size={16} />
        <span className="font-semibold text-sm">{t.severity[severity]}</span>
        <span className="ml-auto text-xs font-bold bg-white/60 px-2 py-0.5 rounded-full">
          {alerts.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {alerts.map(a => (
          <AlertCard
            key={a.id}
            alert={a}
            resolving={resolving.has(a.id)}
            onRemind={onRemind}
            onResolve={onResolve}
          />
        ))}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-slate-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Bone className="w-9 h-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Bone className="h-4 w-32" />
          <Bone className="h-3 w-24" />
          <Bone className="h-3 w-40" />
          <Bone className="h-3 w-28" />
        </div>
      </div>
      <div className="flex gap-2 pt-3 border-t border-slate-100">
        <Bone className="flex-1 h-7 rounded-lg" />
        <Bone className="flex-1 h-7 rounded-lg" />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SEVERITIES = ['critical', 'warning', 'info']

export default function Compliance() {
  const toast  = useToast()
  const { t }  = useLanguage()
  const [allAlerts,   setAllAlerts]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [resolving,   setResolving]   = useState(new Set())
  const [resolved,    setResolved]    = useState(new Set())
  const [reminderFor, setReminderFor] = useState(null)
  const [sevFilter,   setSevFilter]   = useState('')
  const [deptFilter,  setDeptFilter]  = useState('')

  useEffect(() => {
    getCompliance()
      .then(data => setAllAlerts(normalizeAlerts(data)))
      .catch(err => toast.error(`Failed to load compliance data: ${err.message}`))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleResolve(id) {
    setResolving(prev => new Set([...prev, id]))
    setTimeout(() => {
      setResolved(prev  => new Set([...prev, id]))
      setResolving(prev => { const s = new Set(prev); s.delete(id); return s })
    }, 320)
  }

  const departments = useMemo(
    () => [...new Set(allAlerts.map(a => a.department).filter(Boolean))].sort(),
    [allAlerts],
  )

  const visible = useMemo(() => allAlerts.filter(a => {
    if (resolved.has(a.id))                        return false
    if (sevFilter  && a.severity  !== sevFilter)   return false
    if (deptFilter && a.department !== deptFilter)  return false
    return true
  }), [allAlerts, resolved, sevFilter, deptFilter])

  const grouped = useMemo(() => ({
    critical: visible.filter(a => a.severity === 'critical'),
    warning:  visible.filter(a => a.severity === 'warning'),
    info:     visible.filter(a => a.severity === 'info'),
  }), [visible])

  const totalResolved = resolved.size

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t.pages.compliance}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading
              ? t.compliance.loading
              : `${visible.length} active alert${visible.length !== 1 ? 's' : ''}${totalResolved > 0 ? ` · ${totalResolved} resolved this session` : ''}`
            }
          </p>
        </div>

        {/* Summary dots */}
        {!loading && (
          <div className="flex gap-2 flex-wrap">
            {SEVERITIES.map(s => {
              const count = grouped[s].length
              if (count === 0) return null
              return (
                <span key={s} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg shadow-sm">
                  <span className={`w-2 h-2 rounded-full ${SEV[s].dotCls}`} />
                  {count} {t.severity[s]}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Filter bar */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3.5 flex items-center gap-3 flex-wrap">
          <Filter size={15} className="text-slate-400 shrink-0" />

          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSevFilter('')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                sevFilter === '' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.buttons.all}
            </button>
            {SEVERITIES.map(s => (
              <button
                key={s}
                onClick={() => setSevFilter(prev => prev === s ? '' : s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                  sevFilter === s ? SEV[s].badgeCls : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.severity[s]}
              </button>
            ))}
          </div>

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="ml-auto px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">{t.compliance.allDepartments}</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-6">
          {['Critical', 'Warning'].map(label => (
            <div key={label}>
              <Bone className="h-10 rounded-lg mb-3 w-36" />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 py-20 text-center">
          <CheckCircle2 size={36} className="mx-auto text-emerald-300 mb-3" />
          <p className="font-semibold text-slate-700">
            {totalResolved > 0 && !sevFilter && !deptFilter ? t.empty.allCaughtUp : t.empty.noAlertsMatch}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {totalResolved > 0 && !sevFilter && !deptFilter
              ? `${totalResolved} alert${totalResolved !== 1 ? 's' : ''} resolved this session`
              : t.compliance.tryAdjusting
            }
          </p>
          {(sevFilter || deptFilter) && (
            <button
              onClick={() => { setSevFilter(''); setDeptFilter('') }}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              {t.buttons.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {SEVERITIES.map(s => (
            <Section
              key={s}
              severity={s}
              alerts={grouped[s]}
              resolving={resolving}
              onRemind={setReminderFor}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}

      {/* Reminder modal */}
      {reminderFor && (
        <ReminderModal alert={reminderFor} onClose={() => setReminderFor(null)} />
      )}

    </div>
  )
}
