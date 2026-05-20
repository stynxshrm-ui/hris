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
import { orchestrate } from '../agent/mistral_orchestrator.js'

import {
  getEmployee,
  searchEmployees,
  getCourseEnrollments,
  getComplianceAlerts,
  getHeadcountSummary,
  transferEmployee,
} from '../agent/tools.js'

import { createClient } from '@supabase/supabase-js'
import { Mistral } from '@mistralai/mistralai'
import ws from 'ws'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Supabase client (direct queries not covered by agent tool functions) ──────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
)

// ── Policy index (front matter only, loaded at startup) ───────────────────────
const POLICIES_DIR = path.resolve(__dirname, '../docs/policies')

const POLICY_FILENAMES = {
  en: ['employee-handbook-en.md', 'absence-policy-en.md', 'ld-policy-en.md'],
  sv: ['employee-handbook-sv.md', 'absence-policy-sv.md', 'ld-policy-sv.md'],
}

function parseFrontMatter(yamlText) {
  const result = {}
  let currentKey = null
  for (const line of yamlText.split('\n')) {
    const scalar   = line.match(/^(\w+):\s*(.+)$/)
    const listKey  = line.match(/^(\w+):\s*$/)
    const listItem = line.match(/^\s+-\s+(.+)$/)
    if (scalar) {
      currentKey = scalar[1]
      result[currentKey] = scalar[2].trim()
    } else if (listKey) {
      currentKey = listKey[1]
      result[currentKey] = []
    } else if (listItem && currentKey && Array.isArray(result[currentKey])) {
      result[currentKey].push(listItem[1].trim())
    }
  }
  return result
}

function readFrontMatterOnly(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  if (lines[0].trim() !== '---') return null
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (closeIdx === -1) return null
  return parseFrontMatter(lines.slice(1, closeIdx).join('\n'))
}

function stripFrontMatter(content) {
  const lines = content.split('\n')
  if (lines[0].trim() !== '---') return content
  const closeIdx = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  return closeIdx === -1 ? content : lines.slice(closeIdx + 1).join('\n').trimStart()
}

let policyIndex = {}
try {
  for (const filenames of Object.values(POLICY_FILENAMES)) {
    for (const filename of filenames) {
      const meta = readFrontMatterOnly(path.join(POLICIES_DIR, filename))
      if (meta) policyIndex[filename] = meta
    }
  }
  console.log(`[SmartHRIS] Loaded policy index: ${Object.keys(policyIndex).length} documents`)
} catch (err) {
  console.error('[SmartHRIS] Failed to load policy index:', err.message)
}

// ── Express app ───────────────────────────────────────────────────────────────
const app = express()
const PORT = Number(process.env.PORT) || 3001

// CORS: production allows only FRONTEND_URL; development also allows any localhost origin.
// Set FRONTEND_URL on Render to the Vercel deployment URL.
const ALLOWED_ORIGINS = [process.env.FRONTEND_URL].filter(Boolean)
const IS_DEV = process.env.NODE_ENV !== 'production'

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (IS_DEV && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin not allowed — ${origin}`))
  },
  credentials: true,
}))
app.use(express.json())

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Race `promise` against a timeout. Rejects with `message` if `ms` elapses first.
 * @template T
 * @param {Promise<T>} promise
 * @param {number}     ms
 * @param {string}     message
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, message) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(Object.assign(new Error(message), { code: 'TIMEOUT' })), ms)
  )
  return Promise.race([promise, timer])
}

// ── GET /api/health ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() })
})

// ── POST /api/chat ────────────────────────────────────────────────────────────
// Body: { message: string, conversationHistory?: CleanHistoryTurn[] }
// Returns: { intent, response: object, cleanHistory }
app.post('/api/chat', async (req, res) => {
  const { message, conversationHistory } = req.body ?? {}

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      error: 'message must be a non-empty string',
      code:  'INVALID_INPUT',
    })
  }

  if (conversationHistory !== undefined && !Array.isArray(conversationHistory)) {
    return res.status(400).json({
      error: 'conversationHistory must be an array',
      code:  'INVALID_INPUT',
    })
  }

  try {
    const result = await withTimeout(
      orchestrate(message.trim(), conversationHistory ?? []),
      30_000,
      'The AI assistant took too long to respond. Please try again.'
    )

    // Mistral sometimes wraps JSON in a markdown code fence — strip it first
    const raw = result.response.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    let parsed
    try {
      parsed = JSON.parse(raw)
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
    const status = err.code === 'TIMEOUT' ? 504 : 500
    res.status(status).json({ error: err.message, code: err.code ?? 'INTERNAL_ERROR' })
  }
})

// ── GET /api/compliance ───────────────────────────────────────────────────────
// Returns overdue mandatory training and certifications expiring within 30 days.
app.get('/api/compliance', async (_req, res) => {
  try {
    const result = await getComplianceAlerts()
    if (!result.success) return res.status(500).json({ error: result.error, code: 'DB_ERROR' })
    res.json(result.data)
  } catch (err) {
    console.error('[GET /api/compliance]', err.message)
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' })
  }
})

// ── GET /api/employees/:id/enrollments ───────────────────────────────────────
// Returns all course enrollments for a single employee with full course metadata.
app.get('/api/employees/:id/enrollments', async (req, res) => {
  const { id } = req.params
  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Employee id is required', code: 'INVALID_INPUT' })
  }
  try {
    const result = await getCourseEnrollments(id)
    if (!result.success) return res.status(500).json({ error: result.error, code: 'DB_ERROR' })
    res.json(result.data)
  } catch (err) {
    console.error('[GET /api/employees/:id/enrollments]', err.message)
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' })
  }
})

// ── GET /api/employees/:id/leave-requests ────────────────────────────────────
// Returns all leave requests for a single employee, newest first.
app.get('/api/employees/:id/leave-requests', async (req, res) => {
  const { id } = req.params
  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Employee id is required', code: 'INVALID_INPUT' })
  }
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('id, type, start_date, end_date, days, status, reason, created_at')
      .eq('employee_id', id)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message, code: 'DB_ERROR' })
    res.json({ data, total: data.length })
  } catch (err) {
    console.error('[GET /api/employees/:id/leave-requests]', err.message)
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' })
  }
})

// ── GET /api/employees/:id ────────────────────────────────────────────────────
// Returns a single employee's full profile including compensation and HR fields.
app.get('/api/employees/:id', async (req, res) => {
  const { id } = req.params
  if (!id || !id.trim()) {
    return res.status(400).json({ error: 'Employee id is required', code: 'INVALID_INPUT' })
  }
  try {
    const result = await getEmployee(id.trim())
    if (!result.success) return res.status(404).json({ error: result.error, code: 'NOT_FOUND' })
    res.json(result.data)
  } catch (err) {
    console.error('[GET /api/employees/:id]', err.message)
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' })
  }
})

// ── GET /api/employees ────────────────────────────────────────────────────────
// Returns all employees with department and manager joined.
app.get('/api/employees', async (_req, res) => {
  try {
    const result = await searchEmployees({})
    if (!result.success) return res.status(500).json({ error: result.error, code: 'DB_ERROR' })
    res.json({ data: result.data, total: result.total })
  } catch (err) {
    console.error('[GET /api/employees]', err.message)
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' })
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

    if (error) return res.status(500).json({ error: error.message, code: 'DB_ERROR' })

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
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' })
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

    if (!headcountResult.success) return res.status(500).json({ error: headcountResult.error, code: 'DB_ERROR' })
    if (!alertsResult.success)   return res.status(500).json({ error: alertsResult.error,   code: 'DB_ERROR' })
    if (enrErr)                  return res.status(500).json({ error: enrErr.message,        code: 'DB_ERROR' })

    const total     = enrollments.length
    const completed = enrollments.filter(e => e.status === 'completed').length
    const avg_course_completion_rate = total > 0
      ? Math.round((completed / total) * 100)
      : 0

    res.json({
      headcount:                   headcountResult.data,
      overdue_training_count:      alertsResult.data.overdue_mandatory_training.length,
      expiring_certifications_30d: alertsResult.data.expiring_certifications.length,
      top_overdue_training:        alertsResult.data.overdue_mandatory_training.slice(0, 3),
      top_expiring_certs:          alertsResult.data.expiring_certifications.slice(0, 3),
      avg_course_completion_rate,
      generated_at:                new Date().toISOString(),
    })
  } catch (err) {
    console.error('[GET /api/analytics]', err.message)
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' })
  }
})

// ── POST /api/transfer ────────────────────────────────────────────────────────
// Body: { employeeId: string, newDepartment: string (name or UUID) }
// Commits the department change and returns the enrollment diff.
// Enrollment changes are NOT applied automatically — call
// confirmTransferEnrollments() separately after reviewing the diff.
app.post('/api/transfer', async (req, res) => {
  const { employeeId, newDepartment } = req.body ?? {}

  if (!employeeId || typeof employeeId !== 'string' || !employeeId.trim()) {
    return res.status(400).json({ error: 'employeeId must be a non-empty string', code: 'INVALID_INPUT' })
  }
  if (!newDepartment || typeof newDepartment !== 'string' || !newDepartment.trim()) {
    return res.status(400).json({ error: 'newDepartment must be a non-empty string', code: 'INVALID_INPUT' })
  }

  try {
    const result = await transferEmployee(employeeId.trim(), newDepartment.trim())
    if (!result.success) return res.status(400).json({ error: result.error, code: 'TRANSFER_FAILED' })
    res.json(result.data)
  } catch (err) {
    console.error('[POST /api/transfer]', err.message)
    res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' })
  }
})

// ── POST /api/policy-chat ─────────────────────────────────────────────────────
// Body: { question: string, language?: 'en' | 'sv' }
// Returns: { answer: string }
//
// Two-call flow:
//   1. Send lightweight front-matter index + question → get relevant doc IDs.
//   2. Load full content only for matched docs, strip front matter, answer question.
app.post('/api/policy-chat', async (req, res) => {
  const { question, language } = req.body ?? {}

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question must be a non-empty string', code: 'INVALID_INPUT' })
  }

  const lang      = language === 'sv' ? 'sv' : 'en'
  const filenames = POLICY_FILENAMES[lang]
  const missing   = filenames.filter(f => !policyIndex[f])

  if (missing.length > 0) {
    return res.status(503).json({
      error: `Policy index not available: ${missing.join(', ')}`,
      code:  'POLICIES_UNAVAILABLE',
    })
  }

  const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })

  // ── Call 1: routing — which documents are relevant? ──────────────────────────
  const headerBlock = filenames
    .map(f => {
      const m = policyIndex[f]
      return [
        `Document ID: ${m.id}`,
        `Title: ${m.title}`,
        `Covers: ${(m.covers ?? []).join(', ')}`,
        `Irrelevant for: ${(m.irrelevant_for ?? []).join(', ')}`,
      ].join('\n')
    })
    .join('\n\n')

  const routingPrompt = `You are a document routing assistant. \
Given the index of available policy documents and a user question, return a JSON array \
of document IDs that are relevant to answering the question. \
Return only the JSON array and nothing else — no explanation, no markdown. \
If no documents are relevant return an empty array [].

Available documents:
${headerBlock}

User question: ${question.trim()}`

  let relevantIds = []
  try {
    const routingRes = await withTimeout(
      client.chat.complete({
        model:     'mistral-large-latest',
        maxTokens: 64,
        messages:  [{ role: 'user', content: routingPrompt }],
      }),
      15_000,
      'Policy routing took too long.'
    )
    const raw = (routingRes.choices[0].message.content ?? '').trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) relevantIds = parsed
  } catch (err) {
    console.error('[POST /api/policy-chat] routing:', err.message)
    return res.status(500).json({ error: 'Failed to determine relevant documents.', code: 'INTERNAL_ERROR' })
  }

  if (relevantIds.length === 0) {
    return res.json({
      answer: "Your question doesn't appear to be covered by the current company policies on file. " +
              'Please contact People & Culture at people@nordtech.se for further guidance.',
    })
  }

  // ── Load full content for matched documents only ──────────────────────────────
  const matchedFilenames = filenames.filter(f => relevantIds.includes(policyIndex[f]?.id))

  if (matchedFilenames.length === 0) {
    return res.json({
      answer: "Your question doesn't appear to be covered by the current company policies on file. " +
              'Please contact People & Culture at people@nordtech.se for further guidance.',
    })
  }

  let policyContext
  try {
    policyContext = matchedFilenames
      .map(f => {
        const raw = fs.readFileSync(path.join(POLICIES_DIR, f), 'utf8')
        return `### ${policyIndex[f].title}\n\n${stripFrontMatter(raw)}`
      })
      .join('\n\n---\n\n')
  } catch (err) {
    console.error('[POST /api/policy-chat] file load:', err.message)
    return res.status(503).json({ error: 'Policy documents could not be loaded.', code: 'POLICIES_UNAVAILABLE' })
  }

  // ── Call 2: answer using only the matched full documents ──────────────────────
  const systemPrompt = `You are an HR Policy Assistant for NordTech AB. \
You answer employee questions strictly based on the policy documents provided below.
Rules:
- Always state which document and section number your answer comes from (e.g. "Employee Handbook, Section 2.3").
- Be conversational and direct — avoid bullet-heavy responses unless listing multiple distinct items.
- If the answer is not found in the documents, say so clearly: do not guess or invent information.
- Do not reference information from outside the provided documents.

${policyContext}`

  try {
    const answerRes = await withTimeout(
      client.chat.complete({
        model:     'mistral-large-latest',
        maxTokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: question.trim() },
        ],
      }),
      30_000,
      'The policy assistant took too long to respond. Please try again.'
    )

    res.json({ answer: answerRes.choices[0].message.content ?? '' })
  } catch (err) {
    console.error('[POST /api/policy-chat]', err.message)
    const status = err.code === 'TIMEOUT' ? 504 : 500
    res.status(status).json({ error: err.message, code: err.code ?? 'INTERNAL_ERROR' })
  }
})

// ── Error handler (catches express.json() parse failures) ─────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body', code: 'INVALID_JSON' })
  }
  console.error('[server] Unhandled error:', err.message)
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' })
})

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SmartHRIS API] listening on port ${PORT}`)
  console.log(`  CORS origins: ${ALLOWED_ORIGINS.join(', ')}`)
})
