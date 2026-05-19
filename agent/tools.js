/**
 * SmartHRIS AI Agent — Supabase Tool Functions
 *
 * Six functions used by the AI agent to query and mutate the
 * SmartHRIS Supabase database.
 *
 * Requires:
 *   SUPABASE_URL              — project URL
 *   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS; server-side only, never expose to browser
 *
 * Install: npm install @supabase/supabase-js
 */

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

// Service role key is used deliberately here, not the anon key.
// The AI agent runs entirely server-side and must query across all employees
// regardless of their department or auth state (e.g. to compute compliance
// alerts, headcount summaries, or process a transfer). The service role key
// bypasses Row Level Security, which is correct for this trusted server context.
// Never expose this key to the browser or include it in client-side bundles.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  // Node < 22 has no native WebSocket global; pass the ws package so the
  // Realtime client can initialise. The agent never subscribes to channels,
  // but supabase-js always constructs the Realtime client at startup.
  { realtime: { transport: ws } }
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─────────────────────────────────────────────────────────────────────────────
// 1. getEmployee
//    Fetches a single employee by UUID, joined with their department and manager.
//
//    Returns:
//      { success: true,  data: { id, name, job_title, hire_date, status,
//                                location, role, department, manager } }
//      { success: false, error: string, data: null }
// ─────────────────────────────────────────────────────────────────────────────
export async function getEmployee(id) {
  console.log(`[getEmployee] id=${id}`)

  try {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        id,
        name,
        job_title,
        hire_date,
        status,
        location,
        role,
        created_at,
        department:departments(id, name, cost_center),
        manager:employees!manager_id(id, name, job_title)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    console.log(`[getEmployee] ✓ ${data.name} — ${data.department?.name} / ${data.status}`)
    return { success: true, data }
  } catch (err) {
    console.error(`[getEmployee] ERROR:`, err.message)
    return { success: false, error: err.message, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. searchEmployees
//    Queries employees with optional filters. All filters are additive (AND).
//
//    filters.department  — department name (partial, case-insensitive) or UUID
//    filters.status      — 'Active' | 'On Leave' | 'Terminated'
//    filters.hireDateFrom — 'YYYY-MM-DD' inclusive lower bound
//    filters.hireDateTo   — 'YYYY-MM-DD' inclusive upper bound
//
//    Returns:
//      { success: true, data: Employee[], total: number, filters }
//      { success: false, error: string, data: null }
// ─────────────────────────────────────────────────────────────────────────────
export async function searchEmployees(filters = {}) {
  const { department, status, hireDateFrom, hireDateTo } = filters
  console.log(`[searchEmployees] filters=${JSON.stringify(filters)}`)

  try {
    let query = supabase
      .from('employees')
      .select(`
        id,
        name,
        job_title,
        hire_date,
        status,
        location,
        role,
        department:departments(id, name),
        manager:employees!manager_id(id, name)
      `)
      .order('name')

    // Resolve department: accepts a UUID or a (partial) department name
    if (department) {
      if (UUID_RE.test(department)) {
        query = query.eq('department_id', department)
      } else {
        const { data: dept, error: deptErr } = await supabase
          .from('departments')
          .select('id')
          .ilike('name', `%${department}%`)
          .limit(1)
          .single()

        if (deptErr || !dept) {
          console.warn(`[searchEmployees] Department not found: "${department}"`)
          return { success: true, data: [], total: 0, filters }
        }
        query = query.eq('department_id', dept.id)
      }
    }

    if (status)       query = query.eq('status', status)
    if (hireDateFrom) query = query.gte('hire_date', hireDateFrom)
    if (hireDateTo)   query = query.lte('hire_date', hireDateTo)

    const { data, error } = await query
    if (error) throw error

    console.log(`[searchEmployees] ✓ ${data.length} result(s)`)
    return { success: true, data, total: data.length, filters }
  } catch (err) {
    console.error(`[searchEmployees] ERROR:`, err.message)
    return { success: false, error: err.message, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. getCourseEnrollments
//    Returns all enrollment records for one employee, sorted by due_date asc.
//    Each record includes full course metadata and a summary of status counts.
//
//    Returns:
//      { success: true, data: { employee, summary, enrollments } }
//      { success: false, error: string, data: null }
// ─────────────────────────────────────────────────────────────────────────────
export async function getCourseEnrollments(employeeId) {
  console.log(`[getCourseEnrollments] employeeId=${employeeId}`)

  try {
    // Fetch employee name for context
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('id, name')
      .eq('id', employeeId)
      .single()

    if (empErr) throw empErr

    const { data: enrollments, error: enrErr } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        completion_date,
        due_date,
        created_at,
        course:courses(
          id,
          title,
          category,
          duration_hours,
          is_mandatory,
          department:departments(name)
        )
      `)
      .eq('employee_id', employeeId)
      .order('due_date', { ascending: true })

    if (enrErr) throw enrErr

    const summary = enrollments.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1
      return acc
    }, {})

    console.log(
      `[getCourseEnrollments] ✓ ${employee.name} — ` +
      `${enrollments.length} enrollment(s): ${JSON.stringify(summary)}`
    )
    return {
      success: true,
      data: { employee: { id: employee.id, name: employee.name }, summary, enrollments }
    }
  } catch (err) {
    console.error(`[getCourseEnrollments] ERROR:`, err.message)
    return { success: false, error: err.message, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. getComplianceAlerts
//    Returns two alert categories:
//      a) overdue_mandatory_training — enrollments where status='overdue' and
//         the course is_mandatory=true, sorted by most days overdue first.
//      b) expiring_certifications    — certifications whose expiry_date falls
//         within the next 30 days, sorted by soonest first.
//
//    Returns:
//      { success: true, data: { generated_at, total_alerts,
//                               overdue_mandatory_training[], expiring_certifications[] } }
//      { success: false, error: string, data: null }
// ─────────────────────────────────────────────────────────────────────────────
export async function getComplianceAlerts() {
  console.log(`[getComplianceAlerts] Running...`)

  try {
    const today     = new Date()
    const todayStr  = today.toISOString().split('T')[0]
    const in30      = new Date(today)
    in30.setDate(today.getDate() + 30)
    const in30Str   = in30.toISOString().split('T')[0]

    // ── a) Overdue enrollments (filter mandatory in JS to avoid join complexity)
    const { data: overdueRaw, error: overdueErr } = await supabase
      .from('enrollments')
      .select(`
        id,
        due_date,
        employee:employees(
          id, name, job_title,
          department:departments(name)
        ),
        course:courses(id, title, category, is_mandatory)
      `)
      .eq('status', 'overdue')

    if (overdueErr) throw overdueErr

    const overdueTraining = overdueRaw
      .filter(e => e.course?.is_mandatory === true)
      .map(e => ({
        alert_type:    'overdue_mandatory_training',
        employee_id:   e.employee?.id,
        employee_name: e.employee?.name,
        job_title:     e.employee?.job_title,
        department:    e.employee?.department?.name,
        course_id:     e.course?.id,
        course_title:  e.course?.title,
        due_date:      e.due_date,
        days_overdue:  Math.floor((today - new Date(e.due_date)) / 86_400_000)
      }))
      .sort((a, b) => b.days_overdue - a.days_overdue)

    // ── b) Certifications expiring within the next 30 days
    const { data: certRaw, error: certErr } = await supabase
      .from('certifications')
      .select(`
        id,
        issued_date,
        expiry_date,
        employee:employees(
          id, name, job_title,
          department:departments(name)
        ),
        course:courses(id, title, category)
      `)
      .gte('expiry_date', todayStr)
      .lte('expiry_date', in30Str)
      .order('expiry_date', { ascending: true })

    if (certErr) throw certErr

    const expiringCerts = certRaw.map(c => ({
      alert_type:         'certification_expiring',
      employee_id:        c.employee?.id,
      employee_name:      c.employee?.name,
      job_title:          c.employee?.job_title,
      department:         c.employee?.department?.name,
      certification_id:   c.id,
      course_id:          c.course?.id,
      course_title:       c.course?.title,
      issued_date:        c.issued_date,
      expiry_date:        c.expiry_date,
      days_until_expiry:  Math.floor((new Date(c.expiry_date) - today) / 86_400_000)
    }))

    const totalAlerts = overdueTraining.length + expiringCerts.length

    console.log(
      `[getComplianceAlerts] ✓ ${overdueTraining.length} overdue mandatory, ` +
      `${expiringCerts.length} cert(s) expiring within 30 days`
    )
    return {
      success: true,
      data: {
        generated_at:               today.toISOString(),
        total_alerts:               totalAlerts,
        overdue_mandatory_training: overdueTraining,
        expiring_certifications:    expiringCerts
      }
    }
  } catch (err) {
    console.error(`[getComplianceAlerts] ERROR:`, err.message)
    return { success: false, error: err.message, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. getHeadcountSummary
//    Returns employee counts grouped by department × status, plus company totals.
//    Employees with no department join are grouped under 'Unknown'.
//
//    Returns:
//      { success: true, data: { by_department[], totals } }
//      { success: false, error: string, data: null }
// ─────────────────────────────────────────────────────────────────────────────
export async function getHeadcountSummary() {
  console.log(`[getHeadcountSummary] Running...`)

  try {
    const { data, error } = await supabase
      .from('employees')
      .select('status, department:departments(name)')

    if (error) throw error

    // Aggregate: { 'Engineering': { Active: 5, 'On Leave': 1, Terminated: 1 }, … }
    const deptMap = {}
    for (const emp of data) {
      const dept = emp.department?.name ?? 'Unknown'
      if (!deptMap[dept]) deptMap[dept] = { Active: 0, 'On Leave': 0, Terminated: 0 }
      deptMap[dept][emp.status] = (deptMap[dept][emp.status] ?? 0) + 1
    }

    const by_department = Object.entries(deptMap)
      .map(([department, counts]) => ({
        department,
        active:     counts['Active']     ?? 0,
        on_leave:   counts['On Leave']   ?? 0,
        terminated: counts['Terminated'] ?? 0,
        total:      Object.values(counts).reduce((a, b) => a + b, 0)
      }))
      .sort((a, b) => b.total - a.total)

    const totals = by_department.reduce(
      (acc, d) => ({
        active:     acc.active     + d.active,
        on_leave:   acc.on_leave   + d.on_leave,
        terminated: acc.terminated + d.terminated,
        total:      acc.total      + d.total
      }),
      { active: 0, on_leave: 0, terminated: 0, total: 0 }
    )

    console.log(
      `[getHeadcountSummary] ✓ ${totals.total} employees across ` +
      `${by_department.length} departments`
    )
    return { success: true, data: { by_department, totals } }
  } catch (err) {
    console.error(`[getHeadcountSummary] ERROR:`, err.message)
    return { success: false, error: err.message, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. transferEmployee
//    Commits the department change on the employee record, then computes and
//    returns a course diff — but deliberately does NOT touch enrollments.
//
//    Enrollment changes are deferred to confirmTransferEnrollments() so that
//    the calling agent or an HR admin can review the diff before any training
//    history is deleted or created. Executing enrollments silently on transfer
//    would risk data loss if the diff is wrong (e.g. mismatched department tags).
//
//    For a read-only preview without the department write, use previewTransfer().
//
//    newDepartment — department name or UUID
//
//    Returns:
//      { success: true,  data: { employee, transfer,
//                                diff: { employeeId, toUnenroll, toEnroll } } }
//      { success: false, error: string, data: null }
// ─────────────────────────────────────────────────────────────────────────────
export async function transferEmployee(employeeId, newDepartment) {
  console.log(`[transferEmployee] employeeId=${employeeId} → "${newDepartment}"`)

  try {
    // 1. Fetch employee with current department
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('id, name, department_id, department:departments(id, name)')
      .eq('id', employeeId)
      .single()

    if (empErr) throw empErr

    const oldDept = employee.department

    // 2. Resolve target department by name or UUID
    const isUUID = UUID_RE.test(newDepartment)
    const { data: newDept, error: deptErr } = await supabase
      .from('departments')
      .select('id, name')
      .eq(isUUID ? 'id' : 'name', newDepartment)
      .single()

    if (deptErr || !newDept) {
      throw new Error(`Department not found: "${newDepartment}"`)
    }

    if (newDept.id === oldDept.id) {
      return {
        success: false,
        error:   `${employee.name} is already in ${oldDept.name}`,
        data:    null
      }
    }

    // 3. Fetch dept-specific courses for both departments in parallel.
    //    Courses with department_id = NULL are company-wide (mandatory) and unaffected.
    const [{ data: oldCourses }, { data: newCourses }] = await Promise.all([
      supabase
        .from('courses')
        .select('id, title, category, is_mandatory')
        .eq('department_id', oldDept.id),
      supabase
        .from('courses')
        .select('id, title, category, is_mandatory')
        .eq('department_id', newDept.id)
    ])

    // 4. Find which old-dept courses the employee is currently enrolled in
    const oldCourseIds = (oldCourses ?? []).map(c => c.id)

    const { data: activeEnrollments } = oldCourseIds.length
      ? await supabase
          .from('enrollments')
          .select('course_id, status')
          .eq('employee_id', employeeId)
          .in('course_id', oldCourseIds)
      : { data: [] }

    // 5. Compute delta
    const enrolledOldIds = new Set((activeEnrollments ?? []).map(e => e.course_id))

    const toUnenroll = (oldCourses ?? [])
      .filter(c => enrolledOldIds.has(c.id))  // enrolled AND leaving dept

    const toEnroll = (newCourses ?? [])
      .filter(c => !enrolledOldIds.has(c.id)) // new dept courses not already enrolled

    // 6. Commit the transfer
    const { error: updateErr } = await supabase
      .from('employees')
      .update({ department_id: newDept.id })
      .eq('id', employeeId)

    if (updateErr) throw updateErr

    console.log(
      `[transferEmployee] ✓ ${employee.name}: ${oldDept.name} → ${newDept.name} | ` +
      `unenroll ${toUnenroll.length} course(s), enroll ${toEnroll.length} course(s)`
    )
    return {
      success: true,
      data: {
        employee: { id: employee.id, name: employee.name },
        transfer: {
          from: { id: oldDept.id, name: oldDept.name },
          to:   { id: newDept.id, name: newDept.name }
        },
        // Pass this diff directly to confirmTransferEnrollments() to execute.
        // Company-wide mandatory courses (department_id = null) are excluded
        // from both arrays — they are unaffected by department transfers.
        diff: {
          employeeId,
          toUnenroll,
          toEnroll
        }
      }
    }
  } catch (err) {
    console.error(`[transferEmployee] ERROR:`, err.message)
    return { success: false, error: err.message, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. previewTransfer  (dry-run alias for transferEmployee)
//    Computes the exact same course diff as transferEmployee but writes nothing
//    to the database — not even the department field. Use this to show an HR
//    admin or the agent what would change before committing.
//
//    Returns identical shape to transferEmployee, with transfer.committed = false.
// ─────────────────────────────────────────────────────────────────────────────
export async function previewTransfer(employeeId, newDepartment) {
  console.log(`[previewTransfer] employeeId=${employeeId} → "${newDepartment}" (dry-run)`)

  try {
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('id, name, department_id, department:departments(id, name)')
      .eq('id', employeeId)
      .single()

    if (empErr) throw empErr

    const oldDept = employee.department

    const isUUID = UUID_RE.test(newDepartment)
    const { data: newDept, error: deptErr } = await supabase
      .from('departments')
      .select('id, name')
      .eq(isUUID ? 'id' : 'name', newDepartment)
      .single()

    if (deptErr || !newDept) throw new Error(`Department not found: "${newDepartment}"`)

    if (newDept.id === oldDept.id) {
      return {
        success: false,
        error:   `${employee.name} is already in ${oldDept.name}`,
        data:    null
      }
    }

    const [{ data: oldCourses }, { data: newCourses }] = await Promise.all([
      supabase.from('courses').select('id, title, category, is_mandatory').eq('department_id', oldDept.id),
      supabase.from('courses').select('id, title, category, is_mandatory').eq('department_id', newDept.id)
    ])

    const oldCourseIds = (oldCourses ?? []).map(c => c.id)
    const { data: activeEnrollments } = oldCourseIds.length
      ? await supabase.from('enrollments').select('course_id').eq('employee_id', employeeId).in('course_id', oldCourseIds)
      : { data: [] }

    const enrolledOldIds = new Set((activeEnrollments ?? []).map(e => e.course_id))
    const toUnenroll = (oldCourses ?? []).filter(c => enrolledOldIds.has(c.id))
    const toEnroll   = (newCourses  ?? []).filter(c => !enrolledOldIds.has(c.id))

    console.log(
      `[previewTransfer] ✓ ${employee.name}: ${oldDept.name} → ${newDept.name} | ` +
      `would unenroll ${toUnenroll.length}, would enroll ${toEnroll.length} (no writes)`
    )
    return {
      success: true,
      data: {
        employee: { id: employee.id, name: employee.name },
        transfer: {
          from:      { id: oldDept.id, name: oldDept.name },
          to:        { id: newDept.id, name: newDept.name },
          committed: false   // nothing was written
        },
        diff: { employeeId, toUnenroll, toEnroll }
      }
    }
  } catch (err) {
    console.error(`[previewTransfer] ERROR:`, err.message)
    return { success: false, error: err.message, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. confirmTransferEnrollments
//    Executes the enrollment diff returned by transferEmployee / previewTransfer
//    after explicit confirmation. Call this only after the agent or HR admin
//    has reviewed the diff — this is the only function that writes to enrollments.
//
//    toUnenroll — array of course objects (must contain .id)
//    toEnroll   — array of course objects (must contain .id)
//
//    New enrollments are created with status 'not_started' and a due_date
//    30 days from today; adjust the due_date in the database or via a
//    follow-up update if a different deadline is needed.
//
//    Returns:
//      { success: true,  data: { unenrolled: number, enrolled: number } }
//      { success: false, error: string, data: null }
// ─────────────────────────────────────────────────────────────────────────────
export async function confirmTransferEnrollments(employeeId, toUnenroll, toEnroll) {
  console.log(
    `[confirmTransferEnrollments] employeeId=${employeeId} | ` +
    `unenroll ${toUnenroll.length}, enroll ${toEnroll.length}`
  )

  try {
    let unenrolledCount = 0
    let enrolledCount   = 0

    // ── Delete old-department enrollments ─────────────────────────────────────
    if (toUnenroll.length > 0) {
      const { error: delErr, count } = await supabase
        .from('enrollments')
        .delete({ count: 'exact' })
        .eq('employee_id', employeeId)
        .in('course_id', toUnenroll.map(c => c.id))

      if (delErr) throw delErr
      unenrolledCount = count ?? toUnenroll.length
    }

    // ── Create new-department enrollments ─────────────────────────────────────
    if (toEnroll.length > 0) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 30)
      const dueDateStr = dueDate.toISOString().split('T')[0]

      const rows = toEnroll.map(c => ({
        employee_id: employeeId,
        course_id:   c.id,
        status:      'not_started',
        due_date:    dueDateStr
      }))

      const { error: insErr, count } = await supabase
        .from('enrollments')
        .insert(rows, { count: 'exact' })

      if (insErr) throw insErr
      enrolledCount = count ?? toEnroll.length
    }

    console.log(
      `[confirmTransferEnrollments] ✓ unenrolled ${unenrolledCount}, ` +
      `enrolled ${enrolledCount}`
    )
    return {
      success: true,
      data: { unenrolled: unenrolledCount, enrolled: enrolledCount }
    }
  } catch (err) {
    console.error(`[confirmTransferEnrollments] ERROR:`, err.message)
    return { success: false, error: err.message, data: null }
  }
}
