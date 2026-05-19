/**
 * SmartHRIS — API service layer
 *
 * Reads the backend base URL from an environment variable so the same code
 * works locally and in production without modification.
 *
 * Create React App:  REACT_APP_API_URL=http://localhost:3001   (in .env.local)
 * Vite:              VITE_API_URL=http://localhost:3001         (in .env.local)
 *                    Replace every process.env.REACT_APP_API_URL reference with
 *                    import.meta.env.VITE_API_URL if you use Vite.
 *
 * All functions:
 *   - Throw an Error with a human-readable message on non-2xx responses
 *   - Return the parsed JSON body on success
 */

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const body = await response.json()
      message = body.error || message
    } catch {
      // response body wasn't JSON — use the status text
      message = response.statusText || message
    }
    throw new Error(message)
  }

  return response.json()
}

// ── POST /api/chat ────────────────────────────────────────────────────────────
/**
 * Send a natural-language HR query to the Claude orchestrator.
 *
 * @param {string}   message              User's query.
 * @param {object[]} [conversationHistory] Prior clean-history turns from the
 *                                         previous response's `cleanHistory` field.
 * @returns {Promise<{
 *   intent:       'hr' | 'learning' | 'cross',
 *   response:     { type: string, data: unknown },
 *   cleanHistory: object[],
 * }>}
 */
export async function sendChat(message, conversationHistory = []) {
  return request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, conversationHistory }),
  })
}

// ── GET /api/employees ────────────────────────────────────────────────────────
/**
 * Fetch all employees with their department and manager.
 *
 * @returns {Promise<{ data: object[], total: number }>}
 */
export async function getEmployees() {
  return request('/api/employees')
}

// ── GET /api/learning ─────────────────────────────────────────────────────────
/**
 * Fetch all courses with per-course enrollment counts broken down by status.
 *
 * @returns {Promise<{ data: object[], total: number }>}
 */
export async function getLearning() {
  return request('/api/learning')
}

// ── GET /api/analytics ────────────────────────────────────────────────────────
/**
 * Fetch aggregated analytics: headcount by department, overdue training count,
 * certifications expiring within 30 days, and average course completion rate.
 *
 * @returns {Promise<{
 *   headcount:                   { by_department: object[], totals: object },
 *   overdue_training_count:      number,
 *   expiring_certifications_30d: number,
 *   avg_course_completion_rate:  number,
 *   generated_at:                string,
 * }>}
 */
export async function getAnalytics() {
  return request('/api/analytics')
}

// ── GET /api/employees/:id/enrollments ───────────────────────────────────────
/**
 * Fetch all course enrollments for a single employee.
 *
 * @param {string} employeeId UUID of the employee.
 * @returns {Promise<{ employee: object, summary: object, enrollments: object[] }>}
 */
export async function getEmployeeEnrollments(employeeId) {
  return request(`/api/employees/${employeeId}/enrollments`)
}

// ── POST /api/transfer ────────────────────────────────────────────────────────
/**
 * Commit a department transfer for an employee.
 * The department change is written immediately; enrollment changes are returned
 * as a diff and must be confirmed separately.
 *
 * @param {string} employeeId    UUID of the employee to transfer.
 * @param {string} newDepartment Department name or UUID of the destination.
 * @returns {Promise<{
 *   employee: { id: string, name: string },
 *   transfer: { from: object, to: object },
 *   diff:     { employeeId: string, toUnenroll: object[], toEnroll: object[] },
 * }>}
 */
export async function transferEmployee(employeeId, newDepartment) {
  return request('/api/transfer', {
    method: 'POST',
    body: JSON.stringify({ employeeId, newDepartment }),
  })
}
