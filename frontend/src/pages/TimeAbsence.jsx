import { CalendarClock } from 'lucide-react'

export default function TimeAbsence() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-slate-400 p-8">
      <CalendarClock size={48} className="text-slate-600" />
      <div>
        <p className="text-lg font-semibold text-slate-300">Time &amp; Absence</p>
        <p className="text-sm mt-1">Coming soon — timesheets, leave requests, and absence management.</p>
      </div>
    </div>
  )
}
