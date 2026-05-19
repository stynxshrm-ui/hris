import { BarChart3, Users, GraduationCap, ShieldCheck, TrendingUp, Download } from 'lucide-react'

const REPORTS = [
  {
    title: 'Headcount by Department',
    description: 'Employee count broken down by department and employment status.',
    icon: Users,
    iconCls: 'bg-blue-100 text-blue-600',
    tag: 'HR',
    tagCls: 'bg-blue-50 text-blue-600',
  },
  {
    title: 'Training Completion Rate',
    description: 'Course completion percentages across all departments and roles.',
    icon: GraduationCap,
    iconCls: 'bg-violet-100 text-violet-600',
    tag: 'Learning',
    tagCls: 'bg-violet-50 text-violet-600',
  },
  {
    title: 'Compliance Overview',
    description: 'Overdue mandatory training and certifications expiring within 30 days.',
    icon: ShieldCheck,
    iconCls: 'bg-red-100 text-red-600',
    tag: 'Compliance',
    tagCls: 'bg-red-50 text-red-600',
  },
  {
    title: 'Hiring Trends',
    description: 'New hires over time, filtered by department and hire date range.',
    icon: TrendingUp,
    iconCls: 'bg-emerald-100 text-emerald-600',
    tag: 'HR',
    tagCls: 'bg-emerald-50 text-emerald-600',
  },
  {
    title: 'Department Transfer Log',
    description: 'History of all employee department transfers with enrollment diffs.',
    icon: BarChart3,
    iconCls: 'bg-amber-100 text-amber-600',
    tag: 'HR',
    tagCls: 'bg-amber-50 text-amber-600',
  },
]

export default function Reports() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Generate and export HR data reports</p>
        </div>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORTS.map(r => {
          const Icon = r.icon
          return (
            <div
              key={r.title}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-lg ${r.iconCls}`}>
                  <Icon size={20} />
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${r.tagCls}`}>
                  {r.tag}
                </span>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800">{r.title}</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{r.description}</p>
              </div>

              <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100">
                <button className="flex-1 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  Generate
                </button>
                <button className="p-2 text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" aria-label="Download">
                  <Download size={15} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
