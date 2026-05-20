import { CalendarClock } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext.jsx'

export default function TimeAbsence() {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-slate-400 p-8">
      <CalendarClock size={48} className="text-slate-600" />
      <div>
        <p className="text-lg font-semibold text-slate-300">{t.pages.timeAbsence}</p>
        <p className="text-sm mt-1">Coming soon — timesheets, leave requests, and absence management.</p>
      </div>
    </div>
  )
}
