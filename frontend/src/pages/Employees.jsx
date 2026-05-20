import { useState, useEffect, useMemo } from 'react'
import {
  Search, X, UserPlus, Building2, GraduationCap,
  Clock, AlertCircle, BookOpen, CheckCircle2, RefreshCw, ArrowRight,
  Calendar, TrendingUp, Briefcase,
} from 'lucide-react'
import {
  getEmployees, getEmployee, getEmployeeEnrollments, getEmployeeLeaveRequests, transferEmployee,
} from '../services/api'
import { useToast } from '../components/ui/Toaster.jsx'

// ── Primitives ────────────────────────────────────────────────────────────────

function Bone({ className }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
}

const AVATAR_COLORS = [
  'bg-blue-500',   'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-pink-500',   'bg-cyan-500',   'bg-indigo-500',  'bg-teal-500',
]
function avatarColor(name) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name) {
  const parts = name.trim().split(/\s+/)
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

function Avatar({ name, size = 'sm' }) {
  const sz = size === 'lg' ? 'w-12 h-12 text-sm' : 'w-8 h-8 text-xs'
  return (
    <div className={`${sz} ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}>
      {initials(name)}
    </div>
  )
}

const STATUS_MAP = {
  Active:     { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  'On Leave': { badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-400' },
  Terminated: { badge: 'bg-red-100 text-red-700',         dot: 'bg-red-400' },
}
function StatusBadge({ status }) {
  const s = STATUS_MAP[status] ?? { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  )
}

const ENROLL_MAP = {
  completed:   { cls: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
  in_progress: { cls: 'bg-blue-100 text-blue-700',       label: 'In Progress' },
  overdue:     { cls: 'bg-red-100 text-red-700',         label: 'Overdue' },
  enrolled:    { cls: 'bg-slate-100 text-slate-600',     label: 'Enrolled' },
}
function EnrollBadge({ status }) {
  const s = ENROLL_MAP[status] ?? { cls: 'bg-slate-100 text-slate-600', label: status }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-50">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Bone className="w-8 h-8 rounded-full shrink-0" />
          <Bone className="h-4 w-32" />
        </div>
      </td>
      <td className="px-5 py-3.5"><Bone className="h-4 w-28" /></td>
      <td className="px-5 py-3.5"><Bone className="h-4 w-36" /></td>
      <td className="px-5 py-3.5"><Bone className="h-6 w-20 rounded-full" /></td>
      <td className="px-5 py-3.5"><Bone className="h-4 w-24" /></td>
    </tr>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtCurrency(v) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(v)
}

// ── Transfer Modal ────────────────────────────────────────────────────────────

function TransferModal({ employee, departments, onClose, onTransferred }) {
  const [dept,    setDept]    = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)
  const [error,   setError]   = useState(null)

  const choices = departments.filter(d => d !== employee.department?.name)

  async function handleTransfer() {
    if (!dept) return
    setLoading(true)
    setError(null)
    try {
      const res = await transferEmployee(employee.id, dept)
      setResult(res)
      onTransferred(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={!loading && !result ? onClose : undefined} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 size={17} className="text-blue-500" />
            <h2 className="font-semibold text-slate-800">Transfer Department</h2>
          </div>
          {!loading && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={20} />
                <p className="font-semibold">Transfer complete</p>
              </div>
              <p className="text-sm text-slate-600">
                <span className="font-medium">{result.employee.name}</span> moved from{' '}
                <span className="font-medium">{result.transfer.from.name}</span>
                <ArrowRight size={13} className="inline mx-1 text-slate-400" />
                <span className="font-medium">{result.transfer.to.name}</span>
              </p>

              {result.diff.toUnenroll.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Unenrolled ({result.diff.toUnenroll.length})
                  </p>
                  <ul className="space-y-1.5">
                    {result.diff.toUnenroll.map(c => (
                      <li key={c.id} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="text-red-400 font-bold mt-px shrink-0">−</span>
                        {c.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.diff.toEnroll.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    New Enrollments ({result.diff.toEnroll.length})
                  </p>
                  <ul className="space-y-1.5">
                    {result.diff.toEnroll.map(c => (
                      <li key={c.id} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="text-emerald-500 font-bold mt-px shrink-0">+</span>
                        {c.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.diff.toUnenroll.length === 0 && result.diff.toEnroll.length === 0 && (
                <p className="text-sm text-slate-500 italic">No course enrollment changes required.</p>
              )}

              <button
                onClick={onClose}
                className="w-full mt-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Moving <span className="font-medium">{employee.name}</span> from{' '}
                <span className="font-medium">{employee.department?.name}</span> to:
              </p>

              <select
                value={dept}
                onChange={e => setDept(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50"
              >
                <option value="">Select a department…</option>
                {choices.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" /> {error}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2.5 text-sm font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={!dept || loading}
                  className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading
                    ? <><RefreshCw size={14} className="animate-spin" /> Transferring…</>
                    : <>Transfer <ArrowRight size={14} /></>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Panel tab components ──────────────────────────────────────────────────────

function InfoGrid({ fields }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
      {fields.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs font-medium text-slate-400 mb-0.5">{label}</p>
          <p className="text-slate-700">{value ?? '—'}</p>
        </div>
      ))}
    </div>
  )
}

function OverviewTab({ employee }) {
  return (
    <div className="px-5 py-5">
      <InfoGrid fields={[
        ['Department',  employee.department?.name ?? '—'],
        ['Manager',     employee.manager?.name    ?? '—'],
        ['Location',    employee.location         ?? '—'],
        ['Hire Date',   fmtDate(employee.hire_date)],
        ['Status',      employee.status           ?? '—'],
        ['Role',        employee.role             ?? '—'],
      ]} />
    </div>
  )
}

function CompensationTab({ employee }) {
  const outOfBand = employee.salary != null &&
    employee.salary_band_min != null &&
    employee.salary_band_max != null &&
    (employee.salary < employee.salary_band_min || employee.salary > employee.salary_band_max)

  const bandLabel = (employee.salary_band_min != null && employee.salary_band_max != null)
    ? `${employee.salary_band ?? ''} (${fmtCurrency(employee.salary_band_min)} – ${fmtCurrency(employee.salary_band_max)})`
    : (employee.salary_band ?? '—')

  return (
    <div className="px-5 py-5 space-y-5">
      {outOfBand && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertCircle size={15} className="shrink-0 mt-px" />
          <span>Salary is outside the designated band</span>
        </div>
      )}
      <InfoGrid fields={[
        ['Salary Band',    bandLabel],
        ['Current Salary', fmtCurrency(employee.salary)],
        ['Last Review',    fmtDate(employee.last_review_date)],
        ['Next Review',    fmtDate(employee.next_review_date)],
      ]} />
    </div>
  )
}

const LEAVE_STATUS_MAP = {
  Pending:  'bg-amber-100 text-amber-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
}

function TimeAbsenceTab({ employee, leaveRequests, leaveLoading }) {
  const pending = (leaveRequests ?? []).filter(r => r.status === 'Pending')

  return (
    <div className="px-5 py-5 space-y-5">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-slate-50 rounded-xl">
          <p className="text-xs font-medium text-slate-400 mb-1">Annual Leave Balance</p>
          {employee.leave_balance != null ? (
            <p className="text-2xl font-bold text-slate-800">
              {employee.leave_balance}
              <span className="text-sm font-normal text-slate-500 ml-1">days</span>
            </p>
          ) : (
            <p className="text-slate-400 text-sm">—</p>
          )}
        </div>
        <div className="p-4 bg-slate-50 rounded-xl">
          <p className="text-xs font-medium text-slate-400 mb-1">Sick Days This Year</p>
          {employee.sick_days_taken != null ? (
            <p className="text-2xl font-bold text-slate-800">
              {employee.sick_days_taken}
              <span className="text-sm font-normal text-slate-500 ml-1">days</span>
            </p>
          ) : (
            <p className="text-slate-400 text-sm">—</p>
          )}
        </div>
      </div>

      {/* Pending leave requests */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={15} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Pending Leave Requests</h3>
          {!leaveLoading && (
            <span className="ml-auto text-xs text-slate-400">{pending.length}</span>
          )}
        </div>

        {leaveLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="p-3 border border-slate-100 rounded-lg space-y-2">
                <Bone className="h-4 w-3/4" />
                <Bone className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : pending.length > 0 ? (
          <ul className="space-y-2">
            {pending.map(r => (
              <li key={r.id} className="p-3 border border-slate-100 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">{r.type} Leave</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fmtDate(r.start_date)} – {fmtDate(r.end_date)}
                      <span className="ml-2">({r.days} day{r.days !== 1 ? 's' : ''})</span>
                    </p>
                    {r.reason && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{r.reason}</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${LEAVE_STATUS_MAP.Pending}`}>
                    Pending
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-6">
            <Calendar size={28} className="mx-auto text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">No pending leave requests</p>
          </div>
        )}
      </div>
    </div>
  )
}

function CareerTab({ employee, isOnProbation, enrollments, enrollLoading }) {
  return (
    <div className="px-5 py-5 space-y-5">
      {/* Career attributes */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Probation Status</p>
          <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
            isOnProbation
              ? 'bg-orange-100 text-orange-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isOnProbation ? 'On Probation' : 'Confirmed'}
          </span>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-400 mb-0.5">Job Grade</p>
          <p className="text-slate-700 font-medium">{employee.job_grade ?? '—'}</p>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Internal Mobility</p>
          <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
            employee.internal_mobility_flag
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-600'
          }`}>
            {employee.internal_mobility_flag ? 'Open to Move' : 'Not Flagged'}
          </span>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap size={15} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Course Enrollments</h3>
          {!enrollLoading && enrollments && (
            <span className="ml-auto text-xs text-slate-400">
              {enrollments.enrollments?.length ?? 0}
            </span>
          )}
        </div>

        {enrollLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-3 border border-slate-100 rounded-lg space-y-2">
                <Bone className="h-4 w-3/4" />
                <Bone className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : enrollments?.enrollments?.length ? (
          <ul className="space-y-2">
            {enrollments.enrollments.map(e => (
              <li key={e.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 leading-snug">{e.course?.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {e.course?.category}
                      {e.course?.is_mandatory && (
                        <span className="ml-2 text-red-500 font-medium">Mandatory</span>
                      )}
                    </p>
                    {e.due_date && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock size={10} /> Due {fmtDate(e.due_date)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <EnrollBadge status={e.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-6">
            <BookOpen size={28} className="mx-auto text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">No course enrollments</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Employee Detail Panel ─────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',     label: 'Overview',      Icon: Briefcase },
  { id: 'compensation', label: 'Compensation',   Icon: TrendingUp },
  { id: 'time',         label: 'Time & Absence', Icon: Calendar },
  { id: 'career',       label: 'Career',         Icon: GraduationCap },
]

function EmployeePanel({
  employee, enrollments, enrollLoading,
  leaveRequests, leaveLoading,
  departments, onClose, onTransferred,
}) {
  const [tab,          setTab]          = useState('overview')
  const [showTransfer, setShowTransfer] = useState(false)

  const isOnProbation = employee.hire_date &&
    (Date.now() - new Date(employee.hire_date).getTime()) / 86_400_000 < 90

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30 bg-black/20" onClick={onClose} />

      {/* Slide-over */}
      <div className="fixed inset-y-0 right-0 z-40 w-[480px] bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Employee Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Identity block */}
        <div className="px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-start gap-4">
            <Avatar name={employee.name} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-base leading-tight">{employee.name}</p>
              <p className="text-sm text-slate-500 mt-0.5">{employee.job_title ?? '—'}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <StatusBadge status={employee.status} />
                {isOnProbation && (
                  <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
                    On Probation
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="border-b border-slate-100 shrink-0">
          <div className="flex">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'overview'     && <OverviewTab employee={employee} />}
          {tab === 'compensation' && <CompensationTab employee={employee} />}
          {tab === 'time'         && (
            <TimeAbsenceTab
              employee={employee}
              leaveRequests={leaveRequests}
              leaveLoading={leaveLoading}
            />
          )}
          {tab === 'career'       && (
            <CareerTab
              employee={employee}
              isOnProbation={isOnProbation}
              enrollments={enrollments}
              enrollLoading={enrollLoading}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={() => setShowTransfer(true)}
            className="w-full py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Building2 size={15} /> Transfer Department
          </button>
        </div>
      </div>

      {showTransfer && (
        <TransferModal
          employee={employee}
          departments={departments}
          onClose={() => setShowTransfer(false)}
          onTransferred={result => {
            onTransferred(result)
            setShowTransfer(false)
          }}
        />
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Employees() {
  const toast = useToast()
  const [employees,     setEmployees]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [deptFilter,    setDeptFilter]    = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [selected,      setSelected]      = useState(null)
  const [enrollments,   setEnrollments]   = useState(null)
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [leaveRequests, setLeaveRequests] = useState(null)
  const [leaveLoading,  setLeaveLoading]  = useState(false)

  useEffect(() => {
    getEmployees()
      .then(res => setEmployees(res.data ?? []))
      .catch(err => toast.error(`Failed to load employees: ${err.message}`))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const departments = useMemo(
    () => [...new Set(employees.map(e => e.department?.name).filter(Boolean))].sort(),
    [employees],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return employees.filter(e => {
      if (q && !e.name.toLowerCase().includes(q) && !(e.job_title ?? '').toLowerCase().includes(q)) return false
      if (deptFilter   && e.department?.name !== deptFilter)  return false
      if (statusFilter && e.status           !== statusFilter) return false
      return true
    })
  }, [employees, search, deptFilter, statusFilter])

  function openPanel(emp) {
    setSelected(emp)
    setEnrollments(null)
    setEnrollLoading(true)
    setLeaveRequests(null)
    setLeaveLoading(true)

    getEmployee(emp.id)
      .then(profile => setSelected(profile))
      .catch(() => {})

    getEmployeeEnrollments(emp.id)
      .then(setEnrollments)
      .catch(err => toast.error(`Could not load enrollments: ${err.message}`))
      .finally(() => setEnrollLoading(false))

    getEmployeeLeaveRequests(emp.id)
      .then(res => setLeaveRequests(res.data ?? []))
      .catch(err => toast.error(`Could not load leave requests: ${err.message}`))
      .finally(() => setLeaveLoading(false))
  }

  function handleTransferred(result) {
    const newDept = { id: result.transfer.to.id, name: result.transfer.to.name }
    setEmployees(prev =>
      prev.map(e => e.id === result.employee.id ? { ...e, department: newDept } : e),
    )
    setSelected(prev => prev ? { ...prev, department: newDept } : prev)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employees</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading
              ? 'Loading…'
              : `${filtered.length} of ${employees.length} employee${employees.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <UserPlus size={16} /> Add Employee
        </button>
      </div>

      {/* Search & filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or job title…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="On Leave">On Leave</option>
            <option value="Terminated">Terminated</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {['Name', 'Department', 'Job Title', 'Status', 'Hire Date'].map(col => (
                <th key={col} className="text-left px-5 py-3 font-medium text-slate-500">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <Search size={32} className="mx-auto mb-3 text-slate-200" />
                  <p className="text-sm font-medium text-slate-400">No employees match your filters</p>
                  <button
                    onClick={() => { setSearch(''); setDeptFilter(''); setStatusFilter('') }}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              filtered.map(emp => (
                <tr
                  key={emp.id}
                  onClick={() => openPanel(emp)}
                  className={`border-b border-slate-50 last:border-0 cursor-pointer transition-colors ${
                    selected?.id === emp.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={emp.name} />
                      <span className="font-medium text-slate-800">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{emp.department?.name ?? '—'}</td>
                  <td className="px-5 py-3.5 text-slate-600">{emp.job_title ?? '—'}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={emp.status} /></td>
                  <td className="px-5 py-3.5 text-slate-500">{fmtDate(emp.hire_date)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <EmployeePanel
          employee={selected}
          enrollments={enrollments}
          enrollLoading={enrollLoading}
          leaveRequests={leaveRequests}
          leaveLoading={leaveLoading}
          departments={departments}
          onClose={() => setSelected(null)}
          onTransferred={handleTransferred}
        />
      )}

    </div>
  )
}
