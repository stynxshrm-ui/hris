import { ShieldAlert, AlertCircle, Clock, RefreshCw } from 'lucide-react'

const OVERDUE = [
  { name: 'Robert Kim',        dept: 'Information Security', course: 'GDPR Fundamentals',           days: 49 },
  { name: 'Carlos Rodriguez',  dept: 'Sales',                course: 'Security Awareness Training',  days: 34 },
]

const EXPIRING = [
  { name: 'Sarah Williams',    dept: 'Engineering',          cert: 'Python for Data Analysis',  date: '2026-06-12', days: 24 },
  { name: 'David Chen',        dept: 'Engineering',          cert: 'Advanced React Patterns',   date: '2026-06-18', days: 30 },
]

export default function Compliance() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Compliance</h1>
          <p className="text-sm text-slate-500 mt-1">Training overdue alerts and expiring certifications</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Summary banner */}
      <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center gap-3">
        <ShieldAlert size={20} className="text-red-500 shrink-0" />
        <p className="text-sm text-red-700 font-medium">
          {OVERDUE.length} employees have overdue mandatory training — action required.
        </p>
      </div>

      {/* Overdue Mandatory Training */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <AlertCircle size={18} className="text-red-500" />
          <h2 className="font-semibold text-slate-800">Overdue Mandatory Training</h2>
          <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            {OVERDUE.length}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-5 py-3 font-medium text-slate-500">Employee</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Department</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Course</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Days Overdue</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {OVERDUE.map(row => (
              <tr key={row.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3.5 font-medium text-slate-800">{row.name}</td>
                <td className="px-5 py-3.5 text-slate-500">{row.dept}</td>
                <td className="px-5 py-3.5 text-slate-600">{row.course}</td>
                <td className="px-5 py-3.5">
                  <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {row.days} days
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button className="text-xs text-blue-600 font-medium hover:underline">Remind</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Expiring Certifications */}
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Clock size={18} className="text-amber-500" />
          <h2 className="font-semibold text-slate-800">Certifications Expiring Within 30 Days</h2>
          <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
            {EXPIRING.length}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-5 py-3 font-medium text-slate-500">Employee</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Department</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Certification</th>
              <th className="text-left px-5 py-3 font-medium text-slate-500">Expires</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {EXPIRING.map(row => (
              <tr key={row.name} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3.5 font-medium text-slate-800">{row.name}</td>
                <td className="px-5 py-3.5 text-slate-500">{row.dept}</td>
                <td className="px-5 py-3.5 text-slate-600">{row.cert}</td>
                <td className="px-5 py-3.5">
                  <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    {row.date} ({row.days}d)
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button className="text-xs text-blue-600 font-medium hover:underline">Enroll</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

    </div>
  )
}
