import { useState, useEffect } from 'react'
import {
  Users, Briefcase, ShieldAlert, GraduationCap,
  TrendingUp, TrendingDown, Minus, AlertCircle, Clock, ArrowRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { getAnalytics } from '../services/api'

// ── Skeleton primitive ────────────────────────────────────────────────────────
function Bone({ className }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, iconCls, trend }) {
  const TrendIcon =
    trend === 'up'   ? TrendingUp :
    trend === 'down' ? TrendingDown : Minus
  const trendCls =
    trend === 'up'   ? 'text-red-400' :
    trend === 'down' ? 'text-emerald-400' : 'text-slate-400'

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
          <p className={`text-xs mt-1 flex items-center gap-1 ${trendCls}`}>
            <TrendIcon size={11} />
            <span className="text-slate-400">{sub}</span>
          </p>
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
          <Bone className="h-3 w-24" />
        </div>
        <Bone className="h-10 w-10 rounded-lg shrink-0" />
      </div>
    </div>
  )
}

// ── Static seed data (no real activity-log endpoint yet) ──────────────────────
const ACTIVITY = [
  { text: "James O'Connor transferred to Data & Analytics", time: 'Today, 9:30 AM',  dot: 'bg-blue-400' },
  { text: 'Sarah Williams completed GDPR Fundamentals',      time: 'Today, 8:15 AM',  dot: 'bg-emerald-400' },
  { text: 'Robert Kim flagged: Security Awareness overdue',  time: 'Yesterday',        dot: 'bg-red-400' },
  { text: 'Carlos Rodriguez enrolled in Risk Management',    time: 'Yesterday',        dot: 'bg-slate-400' },
  { text: 'Aisha Patel completed Advanced React Patterns',   time: '2 days ago',       dot: 'bg-emerald-400' },
]

const TOP_ALERTS = [
  {
    type: 'overdue',
    name: 'Robert Kim',
    dept: 'Information Security',
    detail: 'GDPR Fundamentals — 49 days overdue',
  },
  {
    type: 'overdue',
    name: 'Carlos Rodriguez',
    dept: 'Sales',
    detail: 'Security Awareness Training — 34 days overdue',
  },
  {
    type: 'expiring',
    name: 'Sarah Williams',
    dept: 'Engineering',
    detail: 'Python for Data Analysis — expires Jun 12',
  },
]

// ── Dashboard page ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [analytics, setAnalytics] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    getAnalytics()
      .then(setAnalytics)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const totals    = analytics?.headcount?.totals       ?? {}
  const chartData = analytics?.headcount?.by_department ?? []

  const kpis = [
    {
      label:   'Total Employees',
      value:   loading ? '—' : (totals.total ?? 0),
      sub:     loading ? '' : `${totals.active ?? 0} active · ${totals.on_leave ?? 0} on leave`,
      icon:    Users,
      iconCls: 'bg-blue-100 text-blue-600',
      trend:   'neutral',
    },
    {
      label:   'Open Requisitions',
      value:   '0',
      sub:     'No open positions',
      icon:    Briefcase,
      iconCls: 'bg-emerald-100 text-emerald-600',
      trend:   'neutral',
    },
    {
      label:   'Overdue Training',
      value:   loading ? '—' : (analytics?.overdue_training_count ?? 0),
      sub:     'Mandatory courses',
      icon:    ShieldAlert,
      iconCls: 'bg-red-100 text-red-600',
      trend:   !loading && (analytics?.overdue_training_count ?? 0) > 0 ? 'up' : 'neutral',
    },
    {
      label:   'Certs Expiring Soon',
      value:   loading ? '—' : (analytics?.expiring_certifications_30d ?? 0),
      sub:     'Within 30 days',
      icon:    GraduationCap,
      iconCls: 'bg-amber-100 text-amber-600',
      trend:   !loading && (analytics?.expiring_certifications_30d ?? 0) > 0 ? 'up' : 'neutral',
    },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">{today}</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          Failed to load analytics data: {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          : kpis.map(k => <KpiCard key={k.label} {...k} />)
        }
      </div>

      {/* Chart + Compliance panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Headcount bar chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Headcount by Department</h2>
            <p className="text-xs text-slate-400 mt-0.5">Active · On Leave · Terminated</p>
          </div>

          {loading ? (
            <div className="p-5 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Bone className="h-4 w-28 shrink-0" />
                  <Bone className="h-6" style={{ width: `${60 - i * 8}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-5">
              <ResponsiveContainer width="100%" height={270}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 0, right: 20, top: 4, bottom: 4 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="department"
                    width={140}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                    }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Legend
                    iconSize={8}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 12, paddingTop: 14 }}
                  />
                  <Bar dataKey="active"     name="Active"     stackId="a" fill="#3b82f6" />
                  <Bar dataKey="on_leave"   name="On Leave"   stackId="a" fill="#f59e0b" />
                  <Bar dataKey="terminated" name="Terminated" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Compliance risk summary */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <h2 className="font-semibold text-slate-800">Compliance Alerts</h2>
            {!loading && (
              <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {(analytics?.overdue_training_count ?? 0) + (analytics?.expiring_certifications_30d ?? 0)}
              </span>
            )}
          </div>

          <ul className="divide-y divide-slate-50 flex-1">
            {TOP_ALERTS.map((alert, i) => (
              <li key={i} className="px-5 py-3.5">
                <div className="flex items-start gap-2.5">
                  <span className={`mt-1 shrink-0 w-2 h-2 rounded-full ${
                    alert.type === 'overdue' ? 'bg-red-400' : 'bg-amber-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{alert.name}</p>
                    <p className="text-xs text-slate-400">{alert.dept}</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{alert.detail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="px-5 py-3 border-t border-slate-100 mt-auto">
            <button className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all alerts <ArrowRight size={13} />
            </button>
          </div>
        </div>

      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Recent Activity</h2>
          <button className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            View all <ArrowRight size={13} />
          </button>
        </div>
        <ul className="divide-y divide-slate-50">
          {ACTIVITY.map((item, i) => (
            <li key={i} className="flex items-start gap-3 px-5 py-3.5">
              <span className={`w-2 h-2 rounded-full ${item.dot} mt-1.5 shrink-0`} />
              <div>
                <p className="text-sm text-slate-700">{item.text}</p>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  <Clock size={11} /> {item.time}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

    </div>
  )
}
