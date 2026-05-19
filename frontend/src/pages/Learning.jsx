import { GraduationCap, Clock, BookOpen } from 'lucide-react'

const TABS = ['All Courses', 'Mandatory', 'Department-specific']

const SAMPLE_COURSES = [
  { title: 'GDPR Fundamentals',           category: 'Compliance',   hours: 3, mandatory: true,  dept: null },
  { title: 'Security Awareness Training', category: 'Security',     hours: 2, mandatory: true,  dept: null },
  { title: 'Python for Data Analysis',    category: 'Technical',    hours: 8, mandatory: false, dept: 'Data & Analytics' },
  { title: 'Advanced React Patterns',     category: 'Technical',    hours: 6, mandatory: false, dept: 'Engineering' },
  { title: 'Enterprise Sales Techniques', category: 'Sales',        hours: 4, mandatory: false, dept: 'Sales' },
  { title: 'Risk Management',             category: 'Compliance',   hours: 5, mandatory: false, dept: 'Information Security' },
]

export default function Learning() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Learning &amp; Development</h1>
          <p className="text-sm text-slate-500 mt-1">Course library and enrollment tracking</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              i === 0
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Course grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SAMPLE_COURSES.map(course => (
          <div
            key={course.title}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <BookOpen size={18} className="text-blue-600" />
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end">
                {course.mandatory && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                    Mandatory
                  </span>
                )}
                {course.dept && (
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                    {course.dept}
                  </span>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 text-sm leading-snug">{course.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{course.category}</p>
            </div>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock size={12} /> {course.hours}h
              </span>
              <button className="text-xs text-blue-600 font-medium hover:underline">
                View enrollments →
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
