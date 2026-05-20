import { useState, useEffect, useMemo } from 'react'
import {
  BookOpen, GraduationCap, ShieldAlert, Clock, Award, AlertTriangle,
} from 'lucide-react'
import { useToast } from '../components/ui/Toaster.jsx'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getLearning, getAnalytics, getCompliance } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext.jsx'

// ── Primitives ────────────────────────────────────────────────────────────────

function Bone({ className }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
}

const CATEGORY_COLORS = {
  Compliance: 'bg-blue-100 text-blue-700',
  Security:   'bg-red-100 text-red-700',
  Technical:  'bg-violet-100 text-violet-700',
  Sales:      'bg-emerald-100 text-emerald-700',
}
function CategoryBadge({ category }) {
  const cls = CATEGORY_COLORS[category] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{category}</span>
  )
}

function ProgressBar({ pct }) {
  const clamped = Math.min(100, Math.max(0, pct))
  const color =
    clamped === 100 ? 'bg-emerald-500' :
    clamped >= 50   ? 'bg-blue-500'    :
    clamped > 0     ? 'bg-amber-400'   : 'bg-slate-200'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right tabular-nums">{clamped}%</span>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, iconCls }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          <p className="text-xs text-slate-400 mt-1">{sub}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${iconCls}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1 pr-4">
          <Bone className="h-4 w-28" />
          <Bone className="h-9 w-14" />
          <Bone className="h-3 w-20" />
        </div>
        <Bone className="h-10 w-10 rounded-lg shrink-0" />
      </div>
    </div>
  )
}

// ── Donut chart ───────────────────────────────────────────────────────────────

const DONUT_COLORS = {
  Completed:   '#10b981',
  'In Progress': '#3b82f6',
  Overdue:     '#ef4444',
  Enrolled:    '#94a3b8',
}

function DonutChart({ data, centerPct, loading }) {
  const { t } = useLanguage()
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Bone className="w-44 h-44 rounded-full" />
      </div>
    )
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map(entry => (
              <Cell key={entry.name} fill={DONUT_COLORS[entry.name] ?? '#cbd5e1'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [value, name]}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label — absolutely positioned over the donut hole */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
           style={{ top: 0, bottom: 0 }}>
        <div className="text-center -mt-6">
          <p className="text-2xl font-bold text-slate-800">{centerPct}%</p>
          <p className="text-xs text-slate-400 mt-0.5">{t.learning.completed}</p>
        </div>
      </div>

      {/* Legend below chart */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
        {data.map(entry => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: DONUT_COLORS[entry.name] }} />
            {entry.name} <span className="font-medium text-slate-700">({entry.value})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function completionPct(course) {
  const total = course.enrollment_count ?? 0
  if (total === 0) return 0
  return Math.round(((course.status_breakdown?.completed ?? 0) / total) * 100)
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Learning() {
  const toast  = useToast()
  const { t }  = useLanguage()
  const [courses,    setCourses]    = useState([])
  const [analytics,  setAnalytics]  = useState(null)
  const [compliance, setCompliance] = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    Promise.all([getLearning(), getAnalytics(), getCompliance()])
      .then(([l, a, c]) => {
        setCourses(l.data ?? [])
        setAnalytics(a)
        setCompliance(c)
      })
      .catch(err => toast.error(`Failed to load learning data: ${err.message}`))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived data ──────────────────────────────────────────────────────────

  const donutData = useMemo(() => {
    const agg = { Completed: 0, 'In Progress': 0, Overdue: 0, Enrolled: 0 }
    for (const c of courses) {
      agg['Completed']   += c.status_breakdown?.completed   ?? 0
      agg['In Progress'] += c.status_breakdown?.in_progress ?? 0
      agg['Overdue']     += c.status_breakdown?.overdue     ?? 0
      agg['Enrolled']    += c.status_breakdown?.enrolled    ?? 0
    }
    return Object.entries(agg)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
  }, [courses])

  const centerPct = useMemo(() => {
    const total     = donutData.reduce((s, d) => s + d.value, 0)
    const completed = donutData.find(d => d.name === 'Completed')?.value ?? 0
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }, [donutData])

  const leaderboard = useMemo(() =>
    [...courses]
      .sort((a, b) => (b.status_breakdown?.completed ?? 0) - (a.status_breakdown?.completed ?? 0))
      .slice(0, 5),
    [courses],
  )

  const riskTable = useMemo(() =>
    (compliance?.overdue_mandatory_training ?? []).slice(0, 5),
    [compliance],
  )

  const kpis = [
    {
      label:   t.kpi.totalCourses,
      value:   loading ? '—' : courses.length,
      sub:     loading ? '' : `${courses.filter(c => c.is_mandatory).length} ${t.learning.mandatory.toLowerCase()}`,
      icon:    BookOpen,
      iconCls: 'bg-blue-100 text-blue-600',
    },
    {
      label:   t.kpi.avgCompletion,
      value:   loading ? '—' : `${analytics?.avg_course_completion_rate ?? 0}%`,
      sub:     t.learning.acrossAllEnrollments,
      icon:    GraduationCap,
      iconCls: 'bg-emerald-100 text-emerald-600',
    },
    {
      label:   t.kpi.overdueLearnersLabel,
      value:   loading ? '—' : (analytics?.overdue_training_count ?? 0),
      sub:     t.learning.mandatoryOverdue,
      icon:    ShieldAlert,
      iconCls: 'bg-red-100 text-red-600',
    },
    {
      label:   t.kpi.certsExpiring30,
      value:   loading ? '—' : (analytics?.expiring_certifications_30d ?? 0),
      sub:     t.learning.within30Days,
      icon:    Clock,
      iconCls: 'bg-amber-100 text-amber-600',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t.pages.learning}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.learning.subtitle}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpis.map(k => <KpiCard key={k.label} {...k} />)
        }
      </div>

      {/* Course table + Donut chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Course catalog */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <BookOpen size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-800">{t.learning.courseCatalog}</h2>
            {!loading && (
              <span className="ml-auto text-xs text-slate-400">{courses.length} {t.learning.courses}</span>
            )}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 font-medium text-slate-500">{t.learning.colCourse}</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500">{t.learning.colCategory}</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500 w-8">{t.learning.colHrs}</th>
                <th className="text-left px-5 py-3 font-medium text-slate-500 w-40">{t.learning.colCompletion}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="space-y-1.5">
                        <Bone className="h-4 w-40" />
                        <Bone className="h-3 w-20" />
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><Bone className="h-5 w-20 rounded-full" /></td>
                    <td className="px-5 py-3.5"><Bone className="h-4 w-6" /></td>
                    <td className="px-5 py-3.5"><Bone className="h-3 w-32" /></td>
                  </tr>
                ))
              ) : (
                courses.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-medium text-slate-800 leading-snug">{c.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {c.is_mandatory && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-px bg-red-100 text-red-700 rounded">
                              {t.learning.mandatory}
                            </span>
                          )}
                          {c.department && (
                            <span className="text-[10px] text-slate-400">{c.department}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <CategoryBadge category={c.category} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 tabular-nums">{c.duration_hours}h</td>
                    <td className="px-5 py-3.5">
                      <ProgressBar pct={completionPct(c)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap size={16} className="text-slate-400" />
            <h2 className="font-semibold text-slate-800">{t.learning.enrollmentStatus}</h2>
          </div>
          <DonutChart data={donutData} centerPct={centerPct} loading={loading} />
        </div>

      </div>

      {/* Leaderboard + Risk table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top 5 completed courses */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Award size={16} className="text-amber-500" />
            <h2 className="font-semibold text-slate-800">{t.learning.topCompleted}</h2>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Bone className="w-6 h-6 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Bone className="h-4 w-3/4" />
                    <Bone className="h-2.5 w-full" />
                  </div>
                  <Bone className="h-4 w-8 shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <ol className="divide-y divide-slate-50">
              {leaderboard.map((c, i) => {
                const pct = completionPct(c)
                const completed = c.status_breakdown?.completed ?? 0
                return (
                  <li key={c.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-slate-100 text-slate-600' :
                      i === 2 ? 'bg-orange-100 text-orange-600' :
                               'bg-slate-50 text-slate-400'
                    }`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{c.title}</p>
                      <div className="mt-1">
                        <ProgressBar pct={pct} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-700">{completed}</p>
                      <p className="text-[10px] text-slate-400">{t.learning.done}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {/* Top 5 overdue employees */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="font-semibold text-slate-800">{t.learning.mostOverdue}</h2>
            {!loading && riskTable.length > 0 && (
              <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {compliance?.overdue_mandatory_training?.length ?? 0}
              </span>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 space-y-1.5">
                    <Bone className="h-4 w-28" />
                    <Bone className="h-3 w-40" />
                  </div>
                  <Bone className="h-6 w-16 rounded-full shrink-0" />
                </div>
              ))}
            </div>
          ) : riskTable.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <ShieldAlert size={28} className="mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">{t.learning.noOverdueTraining}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 font-medium text-slate-500">{t.learning.colEmployee}</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">{t.learning.colCourse}</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-500">{t.learning.colOverdue}</th>
                </tr>
              </thead>
              <tbody>
                {riskTable.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{row.employee_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{row.department}</p>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs leading-snug max-w-[140px] truncate">
                      {row.course_title}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
                        {row.days_overdue}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
