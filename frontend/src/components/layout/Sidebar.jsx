import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Network,
  DollarSign,
  CalendarClock,
  BookOpen,
  ShieldCheck,
  Sparkles,
  BarChart3,
  HelpCircle,
} from 'lucide-react'
import clsx from 'clsx'

const NAV_GROUPS = [
  {
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'People',
    items: [
      { label: 'People',         path: '/employees',    icon: Users },
      { label: 'Organisation',   path: '/organisation', icon: Network },
      { label: 'Compensation',   path: '/compensation', icon: DollarSign },
      { label: 'Time & Absence', path: '/time-absence', icon: CalendarClock },
    ],
  },
  {
    section: 'Learning',
    items: [
      { label: 'Course Catalog', path: '/learning',   icon: BookOpen },
      { label: 'Compliance',     path: '/compliance', icon: ShieldCheck },
    ],
  },
  {
    items: [
      { label: 'AI Assistant', path: '/ai-assistant', icon: Sparkles },
      { label: 'Reports',      path: '/reports',      icon: BarChart3 },
    ],
  },
]

function NavItem({ item, open }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      title={!open ? item.label : undefined}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg mx-2 transition-colors duration-150',
          isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
        )
      }
    >
      <Icon size={20} className="shrink-0" />
      <span
        className={clsx(
          'text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden',
          open ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0',
        )}
      >
        {item.label}
      </span>
    </NavLink>
  )
}

function SectionLabel({ label, open }) {
  return (
    <div
      className={clsx(
        'px-5 pt-4 pb-1 transition-all duration-300 overflow-hidden whitespace-nowrap',
        open ? 'opacity-100 h-9' : 'opacity-0 h-0',
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
    </div>
  )
}

export default function Sidebar({ open }) {
  return (
    <aside
      className={clsx(
        'flex flex-col bg-slate-900 border-r border-slate-800 shrink-0 transition-all duration-300 overflow-hidden',
        open ? 'w-64' : 'w-16',
      )}
    >
      {/* Main Menu label — only visible when expanded */}
      <div
        className={clsx(
          'px-5 pt-5 pb-2 transition-all duration-300 overflow-hidden whitespace-nowrap',
          open ? 'opacity-100 h-12' : 'opacity-0 h-5',
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Main Menu
        </span>
      </div>

      {/* Grouped nav */}
      <nav className="flex flex-col gap-0.5 flex-1 pb-4 pt-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.section && <SectionLabel label={group.section} open={open} />}
            {group.items.map(item => (
              <NavItem key={item.path} item={item} open={open} />
            ))}
          </div>
        ))}
      </nav>

      {/* Help — pinned to bottom */}
      <div className="border-t border-slate-800 p-2">
        <button
          title={!open ? 'Help & Support' : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
        >
          <HelpCircle size={20} className="shrink-0" />
          <span
            className={clsx(
              'text-sm font-medium whitespace-nowrap transition-all duration-300 overflow-hidden',
              open ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0',
            )}
          >
            Help & Support
          </span>
        </button>
      </div>
    </aside>
  )
}
