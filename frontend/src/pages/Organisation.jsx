import { useState, useEffect, useMemo } from 'react'
import {
  Network, ChevronRight, ChevronDown, Users, Briefcase, Eye, EyeOff,
} from 'lucide-react'
import { getEmployees } from '../services/api'
import { useToast } from '../components/ui/Toaster.jsx'
import { APPROVED_HEADCOUNT, REQUISITIONS } from '../data/requisitions.js'

// ── Shared primitives ─────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-pink-500',  'bg-cyan-500',   'bg-indigo-500',  'bg-teal-500',
]
function avatarColor(name) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
function initials(name) {
  const p = name.trim().split(/\s+/)
  return (p[0][0] + (p[p.length - 1]?.[0] ?? '')).toUpperCase()
}

function Bone({ className }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
}

const DEPT_COLORS = {
  'Engineering':          'bg-blue-100 text-blue-700',
  'Product':              'bg-violet-100 text-violet-700',
  'Data & Analytics':     'bg-cyan-100 text-cyan-700',
  'Design':               'bg-pink-100 text-pink-700',
  'Information Security': 'bg-red-100 text-red-700',
  'Sales':                'bg-emerald-100 text-emerald-700',
}
function deptColor(name) {
  return DEPT_COLORS[name] ?? 'bg-slate-100 text-slate-600'
}

// ── Department Summary ────────────────────────────────────────────────────────

function UtilBar({ filled, approved }) {
  const pct = approved > 0 ? Math.min(Math.round((filled / approved) * 100), 100) : 0
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : 'bg-amber-400'
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap w-14 text-right">
        {filled} / {approved}
      </span>
    </div>
  )
}

function DepartmentSummary({ employees, loading }) {
  const stats = useMemo(() => {
    const map = {}
    for (const emp of employees) {
      const dept = emp.department?.name
      if (!dept) continue
      if (!map[dept]) map[dept] = { filled: 0 }
      if (emp.status !== 'Terminated') map[dept].filled++
    }
    return Object.entries(map)
      .map(([name, { filled }]) => ({
        name,
        filled,
        approved:  APPROVED_HEADCOUNT[name] ?? filled,
        open_reqs: REQUISITIONS.filter(r => r.department === name).length,
      }))
      .sort((a, b) => b.filled - a.filled)
  }, [employees])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
        <Users size={18} className="text-blue-500 shrink-0" />
        <h2 className="font-semibold text-slate-800">Department Summary</h2>
        {!loading && (
          <span className="text-xs text-slate-400 ml-1">{stats.length} departments</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Department', 'Employees', 'Open Reqs', 'Headcount Utilisation'].map((h, i) => (
                <th
                  key={h}
                  className={`px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide ${
                    i === 0 ? 'text-left' : i === 3 ? 'text-left min-w-[220px]' : 'text-right'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [1, 2, 3, 4, 5, 6].map(i => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-6 py-3.5"><Bone className="h-6 w-36 rounded-full" /></td>
                    <td className="px-6 py-3.5 text-right"><Bone className="h-4 w-6 ml-auto" /></td>
                    <td className="px-6 py-3.5 text-right"><Bone className="h-6 w-6 rounded-full ml-auto" /></td>
                    <td className="px-6 py-3.5"><Bone className="h-2 w-full rounded-full" /></td>
                  </tr>
                ))
              : stats.map(row => (
                  <tr key={row.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${deptColor(row.name)}`}>
                        {row.name}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-slate-700 tabular-nums">
                      {row.filled}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {row.open_reqs > 0 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                          {row.open_reqs}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <UtilBar filled={row.filled} approved={row.approved} />
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Open Requisitions ─────────────────────────────────────────────────────────

const REQ_STATUS = {
  Sourcing:  { cls: 'bg-blue-100 text-blue-700',      dot: 'bg-blue-500' },
  Interview: { cls: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500' },
  Offer:     { cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

function ReqStatusBadge({ status }) {
  const s = REQ_STATUS[status] ?? { cls: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  )
}

const FILTERS = ['All', 'Sourcing', 'Interview', 'Offer']

function OpenRequisitions() {
  const [filter, setFilter] = useState('All')

  const displayed = filter === 'All'
    ? REQUISITIONS
    : REQUISITIONS.filter(r => r.status === filter)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <Briefcase size={18} className="text-blue-500 shrink-0" />
        <h2 className="font-semibold text-slate-800">Open Requisitions</h2>
        <span className="text-xs text-slate-400">{REQUISITIONS.length} open</span>
        <div className="ml-auto flex items-center gap-1">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {f}
              {f !== 'All' && (
                <span className="ml-1 opacity-60">
                  {REQUISITIONS.filter(r => r.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {displayed.map(req => (
          <div key={req.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate mb-1">{req.job_title}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${deptColor(req.department)}`}>
                    {req.department}
                  </span>
                  <span className="text-xs text-slate-400">
                    Hiring manager:{' '}
                    <span className="text-slate-600 font-medium">{req.hiring_manager}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-700 tabular-nums">{req.days_open}d</p>
                  <p className="text-[11px] text-slate-400">open</p>
                </div>
                <ReqStatusBadge status={req.status} />
                <span className="text-[11px] text-slate-300 font-mono hidden lg:block">{req.id}</span>
              </div>
            </div>
          </div>
        ))}
        {displayed.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-400">
            No requisitions with status <span className="font-medium">{filter}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Org Chart ─────────────────────────────────────────────────────────────────

const EMP_STATUS_BADGE = {
  'On Leave':   'bg-amber-100 text-amber-700',
  'Terminated': 'bg-red-100 text-red-600',
}

function NodeCard({ emp }) {
  const dept = emp.department?.name
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow transition-shadow flex-1 min-w-0 ${
        emp.status === 'Terminated' ? 'opacity-50' : ''
      }`}
    >
      <div
        className={`w-9 h-9 ${avatarColor(emp.name)} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}
      >
        {initials(emp.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{emp.name}</p>
        <p className="text-xs text-slate-500 truncate">{emp.job_title}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {dept && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${deptColor(dept)}`}>
              {dept}
            </span>
          )}
          {emp.status !== 'Active' && EMP_STATUS_BADGE[emp.status] && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${EMP_STATUS_BADGE[emp.status]}`}>
              {emp.status}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function OrgNode({ emp, childMap, depth, showTerminated, defaultOpen }) {
  const allChildren = (childMap[emp.id] ?? []).sort((a, b) => a.name.localeCompare(b.name))
  const children = showTerminated
    ? allChildren
    : allChildren.filter(c => c.status !== 'Terminated')
  const hasChildren = children.length > 0

  // depth 0 open by default; expand/collapse all overrides via defaultOpen
  const [open, setOpen] = useState(
    defaultOpen !== undefined ? defaultOpen : depth === 0
  )

  if (!showTerminated && emp.status === 'Terminated') return null

  return (
    <div>
      {/* Node row */}
      <div className="flex items-start gap-2">
        <button
          onClick={() => hasChildren && setOpen(o => !o)}
          className={`mt-[14px] w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
            hasChildren
              ? 'border-slate-300 text-slate-500 hover:bg-slate-100 cursor-pointer'
              : 'border-transparent cursor-default'
          }`}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {hasChildren && (
            open ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          )}
        </button>
        <NodeCard emp={emp} />
      </div>

      {/* Children with tree connectors */}
      {open && hasChildren && (
        <div className="ml-[11px] mt-2 pl-6 border-l-2 border-slate-100 space-y-2">
          {children.map(child => (
            <div key={child.id} className="relative">
              {/* Horizontal branch connector */}
              <div className="absolute -left-6 top-[22px] w-6 border-t-2 border-slate-100" />
              <OrgNode
                emp={child}
                childMap={childMap}
                depth={depth + 1}
                showTerminated={showTerminated}
                defaultOpen={defaultOpen}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OrgChart({ employees, loading }) {
  const [showTerminated, setShowTerminated] = useState(false)
  const [treeKey,      setTreeKey]      = useState(0)
  const [defaultOpen,  setDefaultOpen]  = useState(undefined)

  const { roots, childMap } = useMemo(() => {
    const idSet = new Set(employees.map(e => e.id))
    const childMap = {}
    for (const emp of employees) {
      const mid = emp.manager?.id
      if (!mid || !idSet.has(mid)) continue
      if (!childMap[mid]) childMap[mid] = []
      childMap[mid].push(emp)
    }
    // Roots = employees whose manager is absent from the dataset (C-suite).
    // Sort by direct-report count descending so Amanda appears first.
    const roots = employees
      .filter(e => { const mid = e.manager?.id; return !mid || !idSet.has(mid) })
      .sort((a, b) => (childMap[b.id]?.length ?? 0) - (childMap[a.id]?.length ?? 0))
    return { roots, childMap }
  }, [employees])

  function expandAll()  { setDefaultOpen(true);  setTreeKey(k => k + 1) }
  function collapseAll() { setDefaultOpen(false); setTreeKey(k => k + 1) }

  const activeCount = employees.filter(e => e.status !== 'Terminated').length

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <Network size={18} className="text-blue-500 shrink-0" />
        <h2 className="font-semibold text-slate-800">Org Chart</h2>
        {!loading && (
          <span className="text-xs text-slate-400">{activeCount} active</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowTerminated(s => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {showTerminated ? <EyeOff size={12} /> : <Eye size={12} />}
            {showTerminated ? 'Hide terminated' : 'Show terminated'}
          </button>
          <div className="w-px h-4 bg-slate-200" />
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Collapse all
          </button>
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Expand all
          </button>
        </div>
      </div>

      <div className="p-6 overflow-x-auto">
        {loading ? (
          <div className="space-y-4 max-w-sm">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-2">
                <Bone className="w-5 h-5 rounded shrink-0" />
                <div className="flex-1 flex items-center gap-3 px-4 py-3 border border-slate-100 rounded-xl">
                  <Bone className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Bone className="h-4 w-36" />
                    <Bone className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div key={treeKey} className="space-y-3 max-w-xl">
            {roots.map(root => (
              <OrgNode
                key={root.id}
                emp={root}
                childMap={childMap}
                depth={0}
                showTerminated={showTerminated}
                defaultOpen={defaultOpen}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Organisation() {
  const toast = useToast()
  const [employees, setEmployees] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    getEmployees()
      .then(res => setEmployees(res.data ?? []))
      .catch(err => toast.error(`Failed to load organisation data: ${err.message}`))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Organisation</h1>
        <p className="text-sm text-slate-500 mt-1">ACME Corporation · Workday HCM</p>
      </div>

      <DepartmentSummary employees={employees} loading={loading} />
      <OpenRequisitions />
      <OrgChart employees={employees} loading={loading} />
    </div>
  )
}
