import { useState, useRef, useEffect } from 'react'
import {
  Send, Bot, Sparkles, AlertTriangle, CheckCircle, Info,
  Users, BookOpen, Clock, ChevronRight, FileText, Database,
} from 'lucide-react'
import { sendChat, sendPolicyChat } from '../services/api'
import { useToast } from '../components/ui/Toaster.jsx'
import { useLanguage } from '../contexts/LanguageContext.jsx'

// ── Suggestion icons (order matches t.aiAssistant.suggestions array) ──────────
const SUGGESTION_ICONS = [AlertTriangle, Users, Clock, ChevronRight]

// ── Canned HR Data answers (index matches suggestions array, language-agnostic) ─
const HR_CANNED_ANSWERS = [
  // Q1: overdue training
  {
    type: 'table',
    data: [
      { employee: 'Carlos Rodriguez', department: 'Information Security', course: 'Security Awareness Training',           due: '15 Apr 2026' },
      { employee: 'Robert Kim',       department: 'Data & Analytics',     course: 'Data Privacy & GDPR Compliance',       due: '31 Mar 2026' },
      { employee: 'Kevin Murphy',     department: 'Engineering',           course: 'Kubernetes & Cloud Infrastructure',    due: '15 Mar 2026' },
      { employee: 'Lisa Anderson',    department: 'Design',                course: 'UX Research Methods & Usability Testing', due: '1 Apr 2026' },
      { employee: 'Rachel Kowalski',  department: 'Sales',                 course: 'Enterprise Sales Methodologies',       due: '31 Mar 2026' },
      { employee: 'Aisha Patel',      department: 'Data & Analytics',      course: 'Machine Learning Engineering Foundations', due: '15 Apr 2026' },
    ],
  },
  // Q2: average tenure by department
  {
    type: 'summary',
    data: {
      explanation: 'Engineering has the highest average tenure at 8.9 years, anchored by long-tenured staff including Amanda Foster (12.2 yrs) and David Chen (10.3 yrs). Design is the most recently built team at 5.4 years average.',
      by_department: [
        { department: 'Engineering',         avg_tenure_years: 8.9, headcount: 5 },
        { department: 'Information Security', avg_tenure_years: 8.2, headcount: 2 },
        { department: 'Product',              avg_tenure_years: 7.4, headcount: 2 },
        { department: 'Sales',                avg_tenure_years: 7.2, headcount: 2 },
        { department: 'Data & Analytics',     avg_tenure_years: 6.9, headcount: 2 },
        { department: 'Design',               avg_tenure_years: 5.4, headcount: 2 },
      ],
    },
  },
  // Q3: on leave in Engineering
  {
    type: 'summary',
    data: {
      explanation: '1 Engineering team member is currently on approved leave.',
      employees: [
        { name: 'Marcus Johnson', title: 'Senior Software Engineer', type: 'Sick Leave', start: '14 Apr 2026', end: '16 May 2026', days: 25 },
      ],
    },
  },
  // Q4: upcoming pending leave requests
  {
    type: 'table',
    data: [
      { employee: 'Carlos Rodriguez', department: 'Information Security', type: 'Sick',   start: '22 May 2026', days: 1 },
      { employee: 'Rachel Kowalski',  department: 'Sales',                 type: 'Annual', start: '2 Jun 2026',  days: 5 },
      { employee: 'Jennifer Martinez',department: 'Engineering',           type: 'Annual', start: '9 Jun 2026',  days: 5 },
      { employee: 'David Chen',       department: 'Engineering',           type: 'Annual', start: '14 Jul 2026', days: 5 },
      { employee: 'Robert Kim',       department: 'Data & Analytics',      type: 'Annual', start: '3 Aug 2026',  days: 5 },
    ],
  },
]

// ── Canned policy answers (indexed to match policySuggestions in translations) ─
const CANNED_ANSWERS = {
  en: [
    // Q1: sick pay
    `The **first day** of any sickness absence is an unpaid qualifying day (*karensdag*) — you receive no pay for day 1.

From **day 2 through day 14**, NordTech AB pays sick pay at **80% of your normal daily salary** under the Swedish Sick Pay Act (*Sjuklönelagen*).

From **day 15 onwards**, you transition to sickness benefit (*sjukpenning*) from Försäkringskassan, which you must register with directly. NordTech AB may supplement this in line with your collective agreement or contract.

If your absence reaches **8 consecutive calendar days**, a medical certificate from a licensed physician must be submitted to People & Culture within 2 working days.

*Source: Absence and Leave Policy, sections 2.2–2.3*`,

    // Q2: confidential data on social media
    `NordTech AB does not have a separate social media policy, but sharing confidential or proprietary information — even accidentally — is a serious conduct matter.

Depending on the circumstances, it could be treated as **gross misconduct**. Under section 3.2.2 of the Employee Handbook, gross misconduct permits NordTech AB to dismiss without notice, following a formal investigation approved by People & Culture and the Chief People Officer.

If personal data was shared, GDPR obligations may also apply — this is why annual GDPR and Data Protection training is mandatory for all employees.

**Recommended immediate steps:**
- Report the incident to your line manager and People & Culture right away
- Do not attempt to delete or cover up the post before notifying them
- People & Culture will assess the severity and determine whether any regulatory notifications are required

Acting promptly and transparently is likely to be viewed more favourably than a delay in reporting.

*Source: Employee Handbook, section 3.2; L&D Policy, section 2.2*`,

    // Q3: carry over if ill at year end
    `Under the standard policy, you may carry over a maximum of **5 days** of unused annual leave, provided you notify your line manager and People & Culture by **1 December**. Carried-over leave must be used by **31 March** of the following year.

The policy states that unused leave is forfeited after 31 March unless the failure to take it was directly caused by company-mandated restrictions. **Illness is not listed as an exception in the NordTech AB policy.**

However, under the **Swedish Annual Leave Act (*Semesterlagen*, SFS 1977:480)**, employees who were unable to take their statutory minimum summer leave (4 consecutive weeks) due to illness have additional legal protections that can override the company policy. In those circumstances, unused leave may carry forward beyond the standard 5-day limit.

If you were prevented from taking leave due to illness at year end, contact People & Culture to discuss your situation — Swedish law may entitle you to protection beyond the standard carry-over rules.

*Source: Employee Handbook, section 2.3*`,

    // Q4: missing mandatory training deadline
    `Missing a mandatory training deadline triggers a five-stage escalation process:

| Stage | Trigger | Action |
|---|---|---|
| 1 | Deadline missed | Automated reminder sent; line manager notified |
| 2 | 5 working days late | Formal conversation with line manager; written note added to your record |
| 3 | 10 working days late | Formal written warning issued by People & Culture |
| 4 | 15 working days late | Escalation to senior leadership; system access may be suspended pending completion |
| 5 | 20 working days late | Formal disciplinary process initiated |

If you have a legitimate reason (extended sick leave, approved long-term absence), contact your manager and People & Culture as soon as possible — a revised deadline can be agreed.

For training with regulatory implications such as GDPR or PCI-DSS, NordTech AB reserves the right to skip directly to stage 3 without following the sequential steps.

*Source: L&D Policy, section 2.4*`,

    // Q5: certification repayment after resigning at 8 months
    `Yes — a repayment clause applies if NordTech AB funded a certification costing more than **2,500 SEK** and you voluntarily resign within 12 months of the certification being awarded.

At 8 months, you fall in the **6–12 month window**, so you would owe back **50% of the funded amount**.

| Departure after certification | Repayment |
|---|---|
| Within 6 months | 100% of funded amount |
| 6–12 months | 50% of funded amount |
| After 12 months | No repayment required |

The amount will be deducted from your final salary, or invoiced separately if the final salary is insufficient.

This clause does **not** apply if NordTech AB terminates your employment due to redundancy or dismissal without cause.

*Source: L&D Policy, section 4.4*`,
  ],

  sv: [
    // Q1: sjuklön
    `Den **första dagen** av varje sjukfrånvaro är en obetald karensdag — du får ingen lön för dag 1.

Från **dag 2 till och med dag 14** betalar NordTech AB sjuklön med **80 % av din normala dagslön** enligt sjuklönelagen (SFS 1991:1047).

Från **dag 15 och framåt** övergår du till sjukpenning från Försäkringskassan, som du måste anmäla dig till direkt. NordTech AB kan komplettera detta belopp enligt ditt kollektivavtal eller individuella anställningsavtal.

Om din frånvaro uppgår till **8 sammanhängande kalenderdagar** måste du lämna in ett läkarintyg från en legitimerad läkare till People & Culture inom 2 arbetsdagar.

*Källa: Policy för frånvaro och ledighet, avsnitt 2.2–2.3*`,

    // Q2: konfidentiell data på sociala medier
    `NordTech AB har ingen separat policy för sociala medier, men att dela konfidentiell eller företagsegentlig information — även oavsiktligt — är ett allvarligt uppförandeärende.

Beroende på omständigheterna kan det behandlas som **grov misskötsel**. Enligt avsnitt 3.2.2 i anställningshandboken ger grov misskötsel NordTech AB rätt att avskeda utan uppsägningstid, efter en formell utredning godkänd av People & Culture och personalchefen.

Om personuppgifter delades kan GDPR-skyldigheter också gälla — det är därför obligatorisk GDPR- och dataskyddsutbildning krävs av alla anställda varje år.

**Rekommenderade omedelbara åtgärder:**
- Rapportera händelsen till din närmaste chef och People & Culture omedelbart
- Försök inte ta bort eller dölja inlägget innan du underrättar dem
- People & Culture bedömer allvaret och avgör om tillsynsanmälningar krävs

Att agera snabbt och transparent kommer sannolikt att bedömas mer positivt än en fördröjning i rapporteringen.

*Källa: Anställningshandbok, avsnitt 3.2; Policy för lärande och utveckling, avsnitt 2.2*`,

    // Q3: semesteröverföring vid sjukdom
    `Enligt standardpolicyn kan du överföra maximalt **5 dagar** av oanvänd semester, förutsatt att du underrättar din chef och People & Culture senast den **1 december**. Överförd semester måste tas ut senast den **31 mars** följande år.

Policyn anger att semester förfaller efter 31 mars om inte misslyckandet att ta ut den berodde på företagsbestämda begränsningar. **Sjukdom är inte listat som ett undantag i NordTech ABs policy.**

Enligt **semesterlagen (SFS 1977:480)** har dock anställda som inte kunnat ta ut sin lagstadgade sommarsemester (4 sammanhängande veckor) på grund av sjukdom ett extra lagligt skydd som kan åsidosätta företagets policy. I sådana fall kan oanvänd semester överföras utöver den normala 5-dagarsgränsen.

Om du var förhindrad att ta ut semester på grund av sjukdom vid årets slut, kontakta People & Culture — svensk lag kan ge dig skydd utöver standardreglerna.

*Källa: Anställningshandbok, avsnitt 2.3*`,

    // Q4: missad utbildningsdeadline
    `Att missa en obligatorisk utbildningsdeadline utlöser en femstegseskaleringsprocess:

| Steg | Utlösare | Åtgärd |
|---|---|---|
| 1 | Deadline missad | Automatisk påminnelse skickas; närmaste chef meddelas |
| 2 | 5 arbetsdagar försenad | Formellt samtal med närmaste chef; skriftlig anteckning i personakt |
| 3 | 10 arbetsdagar försenad | Formell skriftlig varning utfärdad av People & Culture |
| 4 | 15 arbetsdagar försenad | Eskalering till ledning; systemåtkomst kan stängas av |
| 5 | 20 arbetsdagar försenad | Formellt disciplinärförfarande initieras |

Om du har ett legitimt skäl (utökad sjukfrånvaro, godkänd frånvaro) kontaktar du din chef och People & Culture så snart som möjligt — en reviderad deadline kan överenskommas.

För utbildning med regulatoriska konsekvenser (GDPR, PCI-DSS, AML) förbehåller sig NordTech AB rätten att hoppa direkt till steg 3 utan att följa de sekventiella stegen.

*Källa: Policy för lärande och utveckling, avsnitt 2.4*`,

    // Q5: certifieringsåterbetalning
    `Ja — en återbetalningsklausul gäller om NordTech AB finansierade en certifiering som kostade mer än **2 500 SEK** och du säger upp dig frivilligt inom 12 månader efter att certifieringen tilldelats.

Vid 8 månader befinner du dig i **6–12 månadersfönstret**, vilket innebär att du är skyldig att betala tillbaka **50 % av det finansierade beloppet**.

| Avgångstidpunkt efter certifiering | Återbetalning |
|---|---|
| Inom 6 månader | 100 % av finansierat belopp |
| 6–12 månader | 50 % av finansierat belopp |
| Efter 12 månader | Ingen återbetalning krävs |

Beloppet dras av från din slutlön, eller faktureras om slutlönen inte täcker det.

Denna klausul gäller **inte** om NordTech AB avslutar din anställning på grund av övertalighet eller avskedande utan saklig grund.

*Källa: Policy för lärande och utveckling, avsnitt 4.4*`,
  ],
}

// ── AIResponseRenderer ────────────────────────────────────────────────────────
// Inspects `type` and renders the right UI component.
function AIResponseRenderer({ response }) {
  if (!response || typeof response !== 'object') {
    return <p className="text-sm text-slate-700 leading-relaxed">{String(response)}</p>
  }

  const { type, data } = response

  // ── text / summary ────────────────────────────────────────────────────────
  if (type === 'text' || type === 'summary') {
    if (typeof data === 'string') {
      return <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{data}</p>
    }

    if (typeof data === 'object' && data !== null) {
      const { explanation, content, ...rest } = data
      const intro = explanation ?? content ?? null

      const arrayFields  = Object.entries(rest).filter(([, v]) => Array.isArray(v) && v.length > 0)
      const scalarFields = Object.entries(rest).filter(([, v]) => !Array.isArray(v) && typeof v !== 'object')
      const objectFields = Object.entries(rest).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))

      const hasExtra = arrayFields.length || scalarFields.length || objectFields.length

      if (!intro && !hasExtra) {
        return <p className="text-sm text-slate-500 italic">No content.</p>
      }

      return (
        <div className="space-y-3">
          {intro && (
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{intro}</p>
          )}

          {arrayFields.map(([key, rows]) => {
            const cols = Object.keys(rows[0] ?? {})
            return (
              <div key={key}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {key.replace(/_/g, ' ')}
                </p>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {cols.map(col => (
                          <th key={col} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                            {col.replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                          {cols.map(col => (
                            <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                              {row[col] == null ? '—' : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {objectFields.map(([key, obj]) => (
            <div key={key}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {key.replace(/_/g, ' ')}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {Object.entries(obj).map(([k, v]) => (
                  <div key={k} className="flex gap-1.5 text-sm">
                    <span className="font-medium text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-slate-700">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {scalarFields.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {scalarFields.map(([k, v]) => (
                <div key={k} className="flex gap-1.5 text-sm">
                  <span className="font-medium text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                  <span className="text-slate-700">{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return <p className="text-sm text-slate-500 italic">No content.</p>
  }

  // ── table ─────────────────────────────────────────────────────────────────
  if (type === 'table') {
    const rows = Array.isArray(data) ? data : []
    if (rows.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-slate-500 italic">
          <Info size={14} /> No results found.
        </div>
      )
    }
    const cols = Object.keys(rows[0])
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {cols.map(col => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
              >
                {cols.map(col => (
                  <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {row[col] == null ? '—' : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── alert_list ────────────────────────────────────────────────────────────
  if (type === 'alert_list') {
    const overdue  = data?.overdue_mandatory_training ?? []
    const expiring = data?.expiring_certifications    ?? []
    const isEmpty  = overdue.length === 0 && expiring.length === 0

    if (isEmpty) {
      return (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle size={15} />
          <span>No compliance alerts — all clear!</span>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {overdue.length > 0 && (
          <AlertSection
            icon={AlertTriangle}
            iconCls="text-red-500"
            headerCls="bg-red-50 border-red-200"
            title={`Overdue Training (${overdue.length})`}
            items={overdue}
            renderItem={a => ({
              primary: a.employee_name,
              secondary: `${a.course_name} · ${a.days_overdue}d overdue`,
              badge: `${a.days_overdue}d`,
              badgeCls: 'bg-red-100 text-red-700',
            })}
          />
        )}
        {expiring.length > 0 && (
          <AlertSection
            icon={Clock}
            iconCls="text-amber-500"
            headerCls="bg-amber-50 border-amber-200"
            title={`Expiring Certifications (${expiring.length})`}
            items={expiring}
            renderItem={a => ({
              primary: a.employee_name,
              secondary: `${a.certification_name} · expires ${a.expiry_date}`,
              badge: `${a.days_until_expiry}d`,
              badgeCls: 'bg-amber-100 text-amber-700',
            })}
          />
        )}
      </div>
    )
  }

  // ── transfer_result ───────────────────────────────────────────────────────
  if (type === 'transfer_result') {
    const { employee, transfer, diff } = data ?? {}
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <CheckCircle size={15} className="text-emerald-500" />
          <span>Transfer complete for <strong>{employee?.name}</strong></span>
        </div>
        {transfer && (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
            <span className="px-2 py-0.5 bg-slate-200 rounded text-xs">{transfer.from?.name}</span>
            <ChevronRight size={14} className="text-slate-400" />
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{transfer.to?.name}</span>
          </div>
        )}
        {diff && (
          <div className="grid grid-cols-2 gap-2">
            {diff.toUnenroll?.length > 0 && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-2.5">
                <p className="text-xs font-semibold text-red-600 mb-1.5">
                  Unenroll ({diff.toUnenroll.length})
                </p>
                {diff.toUnenroll.map((c, i) => (
                  <p key={i} className="text-xs text-red-700 truncate">— {c.title ?? c.course_id}</p>
                ))}
              </div>
            )}
            {diff.toEnroll?.length > 0 && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5">
                <p className="text-xs font-semibold text-emerald-600 mb-1.5">
                  Enroll ({diff.toEnroll.length})
                </p>
                {diff.toEnroll.map((c, i) => (
                  <p key={i} className="text-xs text-emerald-700 truncate">+ {c.title ?? c.course_id}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── fallback: raw JSON ────────────────────────────────────────────────────
  return (
    <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

// ── AlertSection ──────────────────────────────────────────────────────────────
function AlertSection({ icon: Icon, iconCls, headerCls, title, items, renderItem }) {
  return (
    <div className={`rounded-lg border ${headerCls} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${headerCls}`}>
        <Icon size={13} className={iconCls} />
        <span className="text-xs font-semibold text-slate-700">{title}</span>
      </div>
      <div className="divide-y divide-slate-100 bg-white">
        {items.map((item, i) => {
          const { primary, secondary, badge, badgeCls } = renderItem(item)
          return (
            <div key={i} className="flex items-center justify-between px-3 py-2 gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{primary}</p>
                <p className="text-xs text-slate-500 truncate">{secondary}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badgeCls}`}>
                {badge}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Message({ role, response, rawContent, answer, isPolicy, policyLabel }) {
  const isUser = role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isPolicy ? 'bg-amber-500' : 'bg-blue-600'
        }`}>
          {isPolicy
            ? <FileText size={15} className="text-white" />
            : <Bot size={15} className="text-white" />
          }
        </div>
      )}
      <div className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm ${
        isUser
          ? 'bg-blue-600 text-white rounded-br-sm'
          : isPolicy
            ? 'bg-amber-50 border border-amber-100 text-slate-700 rounded-bl-sm'
            : 'bg-slate-100 text-slate-700 rounded-bl-sm'
      }`}>
        {isUser ? (
          <p className="leading-relaxed">{rawContent}</p>
        ) : isPolicy ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
              <FileText size={11} />
              <span>{policyLabel}</span>
            </div>
            <PolicyMarkdown text={answer} />
          </div>
        ) : (
          <AIResponseRenderer response={response} />
        )}
      </div>
    </div>
  )
}

// ── Lightweight markdown renderer for policy responses ───────────────────────
function renderInline(str) {
  const parts = str.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic">{part.slice(1, -1)}</em>
    return part
  })
}

function PolicyMarkdown({ text }) {
  const lines = text.split('\n')
  const elements = []
  let i = 0, key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      elements.push(<p key={key++} className="font-semibold text-slate-800 mt-2">{renderInline(line.slice(3))}</p>)
      i++; continue
    }
    if (line.startsWith('# ')) {
      elements.push(<p key={key++} className="font-bold text-slate-800 mt-2">{renderInline(line.slice(2))}</p>)
      i++; continue
    }
    if (line.trim() === '---') {
      elements.push(<hr key={key++} className="border-amber-200 my-2" />)
      i++; continue
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(<li key={i}>{renderInline(lines[i].slice(2))}</li>)
        i++
      }
      elements.push(<ul key={key++} className="list-disc list-inside space-y-0.5 my-1 text-slate-700">{items}</ul>)
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(<li key={i}>{renderInline(lines[i].replace(/^\d+\.\s/, ''))}</li>)
        i++
      }
      elements.push(<ol key={key++} className="list-decimal list-inside space-y-0.5 my-1 text-slate-700">{items}</ol>)
      continue
    }

    if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[\s\-|:]+\|$/.test(lines[i].trim())) {
          rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()))
        }
        i++
      }
      if (rows.length > 0) {
        elements.push(
          <div key={key++} className="overflow-x-auto rounded border border-amber-200 my-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-amber-50 border-b border-amber-200">
                  {rows[0].map((cell, ci) => (
                    <th key={ci} className="px-2 py-1.5 text-left font-semibold text-slate-600">{renderInline(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-t border-amber-100">
                    {row.map((cell, ci) => <td key={ci} className="px-2 py-1.5 text-slate-700">{renderInline(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      continue
    }

    if (line.trim() === '') { i++; continue }

    elements.push(<p key={key++} className="text-sm text-slate-700 leading-relaxed">{renderInline(line)}</p>)
    i++
  }

  return <div className="space-y-1">{elements}</div>
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator({ isPolicy }) {
  return (
    <div className="flex gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isPolicy ? 'bg-amber-500' : 'bg-blue-600'
      }`}>
        {isPolicy
          ? <FileText size={15} className="text-white" />
          : <Bot size={15} className="text-white" />
        }
      </div>
      <div className={`px-4 py-3.5 rounded-2xl rounded-bl-sm flex gap-1.5 items-center ${
        isPolicy ? 'bg-amber-50 border border-amber-100' : 'bg-slate-100'
      }`}>
        {[0, 150, 300].map(delay => (
          <span
            key={delay}
            className={`w-2 h-2 rounded-full animate-bounce ${isPolicy ? 'bg-amber-400' : 'bg-slate-400'}`}
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const toast              = useToast()
  const { t, language }    = useLanguage()
  const [mode, setMode]    = useState('policy')  // 'hr' | 'policy'
  const [input, setInput]  = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  function makeWelcome(m) {
    if (m === 'policy') {
      return { role: 'assistant', answer: t.aiAssistant.policyWelcome, isPolicy: true }
    }
    return { role: 'assistant', response: { type: 'text', data: { content: t.aiAssistant.welcome } } }
  }

  const [messages, setMessages] = useState(() => [makeWelcome('policy')])

  function switchMode(newMode) {
    if (newMode === mode) return
    setMode(newMode)
    setHistory([])
    setInput('')
    setMessages([makeWelcome(newMode)])
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(text) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')

    setMessages(prev => [...prev, { role: 'user', rawContent: msg }])
    setLoading(true)

    try {
      if (mode === 'policy') {
        const suggestionIndex = (t.aiAssistant.policySuggestions ?? []).indexOf(msg)
        const canned = CANNED_ANSWERS[language]?.[suggestionIndex]
        if (suggestionIndex !== -1 && canned) {
          await new Promise(resolve => setTimeout(resolve, 1800))
          setMessages(prev => [...prev, { role: 'assistant', answer: canned, isPolicy: true }])
        } else {
          const json = await sendPolicyChat(msg, language)
          setMessages(prev => [...prev, { role: 'assistant', answer: json.answer, isPolicy: true }])
        }
      } else {
        const suggestionIndex = (t.aiAssistant.suggestions ?? []).indexOf(msg)
        const canned = HR_CANNED_ANSWERS[suggestionIndex]
        if (suggestionIndex !== -1 && canned) {
          await new Promise(resolve => setTimeout(resolve, 1800))
          setMessages(prev => [...prev, { role: 'assistant', response: canned }])
        } else {
          const json = await sendChat(msg, history)
          let response = json.response
          if (!response || typeof response !== 'object') {
            response = { type: 'text', data: { content: String(response) } }
          }
          setMessages(prev => [...prev, { role: 'assistant', response }])
          setHistory(json.cleanHistory ?? [])
        }
      }
    } catch (err) {
      toast.error(err.message)
      const errMsg = mode === 'policy'
        ? { role: 'assistant', answer: `Sorry, something went wrong: ${err.message}`, isPolicy: true }
        : { role: 'assistant', response: { type: 'text', data: { content: `Sorry, something went wrong: ${err.message}` } } }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const isPolicy       = mode === 'policy'
  const showSuggestions = messages.length === 1 && !loading

  const hrSuggestions = SUGGESTION_ICONS.map((icon, i) => ({
    label: t.aiAssistant.suggestions[i],
    icon,
  }))

  const policySuggestions = (t.aiAssistant.policySuggestions ?? []).map(label => ({ label }))

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-4" style={{ height: 'calc(100vh - 160px)' }}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Sparkles size={22} className="text-blue-500" /> {t.pages.aiAssistant}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isPolicy ? t.aiAssistant.policySubtitle : t.aiAssistant.subtitle}
        </p>
      </div>

      {/* Chat card */}
      <div className="flex flex-col flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-0">

        {/* Mode toggle */}
        <div className="grid grid-cols-2">
          <button
            onClick={() => switchMode('hr')}
            className={`flex flex-col items-center gap-0.5 py-3 px-4 text-sm font-semibold transition-colors border-b-2 ${
              mode === 'hr'
                ? 'border-blue-600 text-blue-600 bg-blue-50'
                : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Database size={15} />
              {t.aiAssistant.modeHrData}
            </div>
            <span className="text-xs font-normal opacity-75">{t.aiAssistant.modeHrDataHint}</span>
          </button>
          <button
            onClick={() => switchMode('policy')}
            className={`flex flex-col items-center gap-0.5 py-3 px-4 text-sm font-semibold transition-colors border-b-2 ${
              mode === 'policy'
                ? 'border-amber-500 text-amber-600 bg-amber-50'
                : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText size={15} />
              {t.aiAssistant.modePolicy}
            </div>
            <span className="text-xs font-normal opacity-75">{t.aiAssistant.modePolicyHint}</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-5 space-y-4">
          {messages.map((m, i) => (
            <Message
              key={i}
              role={m.role}
              response={m.response}
              rawContent={m.rawContent}
              answer={m.answer}
              isPolicy={m.isPolicy}
              policyLabel={t.aiAssistant.policyLabel}
            />
          ))}
          {loading && <TypingIndicator isPolicy={isPolicy} />}
          <div ref={bottomRef} />
        </div>

        {/* Suggestion chips — only shown on welcome screen */}
        {showSuggestions && (
          <div className="px-5 pb-3">
            <p className="text-xs text-slate-400 mb-2">
              {isPolicy ? t.aiAssistant.policyTryAsking : t.aiAssistant.tryAsking}
            </p>
            <div className="flex flex-wrap gap-2">
              {(isPolicy ? policySuggestions : hrSuggestions).map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => handleSend(label)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${
                    isPolicy
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  {Icon && <Icon size={12} />}
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="border-t border-slate-100 p-4">
          <form
            onSubmit={e => { e.preventDefault(); handleSend() }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={isPolicy ? t.aiAssistant.policyPlaceholder : t.aiAssistant.placeholder}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 ${
                isPolicy
                  ? 'border-amber-200 focus:ring-amber-400'
                  : 'border-slate-200 focus:ring-blue-500'
              }`}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`p-2.5 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                isPolicy ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
