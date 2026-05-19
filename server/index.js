/**
 * SmartHRIS — Express API Server
 *
 * Routes
 * ──────
 *   POST /api/chat        Natural-language HR query via the Claude orchestrator
 *   GET  /api/employees   All employees from Supabase
 *   GET  /api/learning    All courses with per-course enrollment stats
 *   GET  /api/analytics   Headcount, overdue training, expiring certs, completion rate
 *   POST /api/transfer    Commit a department transfer (returns enrollment diff)
 *   GET  /api/health      Liveness check
 *
 * Environment variables (see .env.example)
 * ─────────────────────────────────────────
 *   ANTHROPIC_API_KEY        Required for /api/chat
 *   SUPABASE_URL             Set by env.js alias; reads NEXT_PUBLIC_SUPABASE_URL if absent
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FRONTEND_URL             Vercel domain for CORS (e.g. https://smarthris.vercel.app)
 *   PORT                     Optional; defaults to 3001
 *
 * env.js is loaded transitively via the orchestrator → tools import chain.
 * All ES module imports evaluate before this module's body runs, so
 * process.env is fully populated before createClient() is called below.
 */

// ── Imports ───────────────────────────────────────────────────────────────────
// orchestrator.js imports env.js as its first import, which loads .env.local
// and aliases NEXT_PUBLIC_SUPABASE_URL → SUPABASE_URL. That side effect
// completes before any module body (including this one) executes.
import { orchestrate } from '../agent/orchestrator.js'

import {
  searchEmployees,
  getComplianceAlerts,
  getHeadcountSummary,
  transferEmployee,
} from '../agent/tools.js'

import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import express from 'express'
import cors from 'cors'

// ── Supabase client (direct queries not covered by agent tool functions) ──────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
)

// ── Express app ───────────────────────────────────────────────────────────────
const app = express()
const PORT = Number(process.env.PORT) || 3001

// CORS: production allows only FRONTEND_URL; development also allows localhost.
// Set FRONTEND_URL on Render to the Vercel deployment URL.
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000'] : []),
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin header) and listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin not allowed — ${origin}`))
  },
  credentials: true,
}))
app.use(express.json())

// ── GET /api/health ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

// ── POST /api/chat ────────────────────────────────────────────────────────────
// Body: { message: string, conversationHistory?: CleanHistoryTurn[] }
// Returns: { intent, response: object, cleanHistory }
app.post('/api/chat', async (req, res) => {
  const { message, conversationHistory = [] } = req.body

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message must be a non-empty string' })
  }

  try {
    const result = await orchestrate(message, conversationHistory)

    // Parse the structured JSON string so the frontend receives a plain object
    let parsed
    try {
      parsed = JSON.parse(result.response)
    } catch {
      parsed = { type: 'text', data: { content: result.response } }
    }

    res.json({
      intent:       result.intent,
      response:     parsed,
      cleanHistory: result.cleanHistory,
    })
  } catch (err) {
    console.error('[POST /api/chat]', err.message)
    res.status(500).json({ error: err.message, code: err.code ?? 'INTERNAL_ERROR' })
  }
})

// ── GET /api/employees ────────────────────────────────────────────────────────
// Returns all employees with department and manager joined.
app.get('/api/employees', async (_req, res) => {
  try {
    const result = await searchEmployees({})
    if (!result.success) return res.status(500).json({ error: result.error })
    res.json({ data: result.data, total: result.total })
  } catch (err) {
    console.error('[GET /api/employees]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/learning ─────────────────────────────────────────────────────────
// Returns all courses with per-course enrollment counts broken down by status.
app.get('/api/learning', async (_req, res) => {
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        category,
        duration_hours,
        is_mandatory,
        department:departments(name),
        enrollments(status)
      `)
      .order('title')

    if (error) return res.status(500).json({ error: error.message })

    const data = courses.map(c => {
      const status_breakdown = c.enrollments.reduce((acc, e) => {
        acc[e.status] = (acc[e.status] ?? 0) + 1
        return acc
      }, {})

      return {
        id:               c.id,
        title:            c.title,
        category:         c.category,
        duration_hours:   c.duration_hours,
        is_mandatory:     c.is_mandatory,
        department:       c.department?.name ?? null,
        enrollment_count: c.enrollments.length,
        status_breakdown,
      }
    })

    res.json({ data, total: data.length })
  } catch (err) {
    console.error('[GET /api/learning]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/analytics ────────────────────────────────────────────────────────
// Aggregates headcount by department, overdue training count, certifications
// expiring within 30 days, and overall course completion rate.
app.get('/api/analytics', async (_req, res) => {
  try {
    const [
      headcountResult,
      alertsResult,
      { data: enrollments, error: enrErr },
    ] = await Promise.all([
      getHeadcountSummary(),
      getComplianceAlerts(),
      supabase.from('enrollments').select('status'),
    ])

    if (!headcountResult.success) return res.status(500).json({ error: headcountResult.error })
    if (!alertsResult.success)   return res.status(500).json({ error: alertsResult.error })
    if (enrErr)                  return res.status(500).json({ error: enrErr.message })

    const total     = enrollments.length
    const completed = enrollments.filter(e => e.status === 'completed').length
    const avg_course_completion_rate = total > 0
      ? Math.round((completed / total) * 100)
      : 0

    res.json({
      headcount:                   headcountResult.data,
      overdue_training_count:      alertsResult.data.overdue_mandatory_training.length,
      expiring_certifications_30d: alertsResult.data.expiring_certifications.length,
      avg_course_completion_rate,
      generated_at:                new Date().toISOString(),
    })
  } catch (err) {
    console.error('[GET /api/analytics]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/transfer ────────────────────────────────────────────────────────
// Body: { employeeId: string, newDepartment: string (name or UUID) }
// Commits the department change and returns the enrollment diff.
// Enrollment changes are NOT applied automatically — call
// confirmTransferEnrollments() separately after reviewing the diff.
app.post('/api/transfer', async (req, res) => {
  const { employeeId, newDepartment } = req.body

  if (!employeeId || !newDepartment) {
    return res.status(400).json({ error: 'employeeId and newDepartment are required' })
  }

  try {
    const result = await transferEmployee(employeeId, newDepartment)
    if (!result.success) return res.status(400).json({ error: result.error })
    res.json(result.data)
  } catch (err) {
    console.error('[POST /api/transfer]', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Error handler (catches express.json() parse failures) ─────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' })
  }
  console.error('[server] Unhandled error:', err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SmartHRIS API] listening on port ${PORT}`)
  console.log(`  CORS origins: ${ALLOWED_ORIGINS.join(', ')}`)
})
