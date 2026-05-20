import { DollarSign } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext.jsx'

export default function Compensation() {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-slate-400 p-8">
      <DollarSign size={48} className="text-slate-600" />
      <div>
        <p className="text-lg font-semibold text-slate-300">{t.pages.compensation}</p>
        <p className="text-sm mt-1">Coming soon — salary bands, pay history, and compensation reviews.</p>
      </div>
    </div>
  )
}
