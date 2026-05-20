/**
 * Mock Workday Recruiting data.
 * APPROVED_HEADCOUNT — budgeted seats per department.
 * REQUISITIONS       — open roles keyed to Workday REQ IDs.
 */

export const APPROVED_HEADCOUNT = {
  'Engineering':          8,
  'Product':              4,
  'Data & Analytics':     4,
  'Design':               3,
  'Information Security': 5,
  'Sales':                5,
}

export const REQUISITIONS = [
  {
    id: 'REQ-2026-001',
    job_title: 'Staff Software Engineer',
    department: 'Engineering',
    hiring_manager: 'David Chen',
    days_open: 45,
    status: 'Interview',
  },
  {
    id: 'REQ-2026-002',
    job_title: 'Frontend Engineer',
    department: 'Engineering',
    hiring_manager: 'David Chen',
    days_open: 12,
    status: 'Sourcing',
  },
  {
    id: 'REQ-2026-003',
    job_title: 'Senior Product Manager',
    department: 'Product',
    hiring_manager: 'Sarah Williams',
    days_open: 28,
    status: 'Interview',
  },
  {
    id: 'REQ-2026-004',
    job_title: 'Machine Learning Engineer',
    department: 'Data & Analytics',
    hiring_manager: 'Robert Kim',
    days_open: 52,
    status: 'Sourcing',
  },
  {
    id: 'REQ-2026-005',
    job_title: 'Data Analyst',
    department: 'Data & Analytics',
    hiring_manager: 'Robert Kim',
    days_open: 8,
    status: 'Sourcing',
  },
  {
    id: 'REQ-2026-006',
    job_title: 'UX Researcher',
    department: 'Design',
    hiring_manager: 'Lisa Anderson',
    days_open: 19,
    status: 'Offer',
  },
  {
    id: 'REQ-2026-007',
    job_title: 'Security Engineer',
    department: 'Information Security',
    hiring_manager: 'Patricia Hughes',
    days_open: 33,
    status: 'Interview',
  },
  {
    id: 'REQ-2026-008',
    job_title: 'Penetration Tester',
    department: 'Information Security',
    hiring_manager: 'Patricia Hughes',
    days_open: 15,
    status: 'Sourcing',
  },
  {
    id: 'REQ-2026-009',
    job_title: 'Account Executive',
    department: 'Sales',
    hiring_manager: 'Thomas Wright',
    days_open: 7,
    status: 'Sourcing',
  },
  {
    id: 'REQ-2026-010',
    job_title: 'Senior Account Executive',
    department: 'Sales',
    hiring_manager: 'Thomas Wright',
    days_open: 38,
    status: 'Offer',
  },
]
