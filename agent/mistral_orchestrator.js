/**
 * SmartHRIS — AI Orchestrator (Mistral)
 *
 * Drop-in replacement for orchestrator.js using Mistral instead of Anthropic.
 * Public API is identical: same exports, same argument shapes, same return shape.
 *
 * Sub-agent tool allocation
 * ─────────────────────────
 *   HR Agent          │ getEmployee · searchEmployees · getHeadcountSummary
 *   Learning Agent    │ getEmployee · searchEmployees · getCourseEnrollments
 *   Cross-system Agent│ all six tools
 *
 * Conversation history
 * ─────────────────────
 * Pass `result.cleanHistory` from the previous turn as `conversationHistory`
 * on the next call. Do NOT pass `result.messages` — it contains raw tool_calls
 * and tool-result turns that may confuse routing across different sub-agents.
 *
 * Key differences from the Anthropic version
 * ───────────────────────────────────────────
 *   • Tool definitions use Mistral/OpenAI schema (type:'function', function:{…})
 *   • System prompt is prepended as { role:'system' } inside runAgentLoop, not a
 *     separate API parameter.
 *   • Tool calls come back as message.toolCalls[]; arguments is a JSON string.
 *   • Tool results go back as individual { role:'tool', toolCallId, content }
 *     messages, not bundled into a single user turn.
 *   • finish_reason 'tool_calls' (not 'tool_use') signals a tool-calling round.
 *
 * Requires:
 *   MISTRAL_API_KEY             — set in environment
 *   SUPABASE_URL                — set in environment (consumed by tools.js)
 *   SUPABASE_SERVICE_ROLE_KEY   — set in environment (consumed by tools.js)
 *
 * Install: npm install @mistralai/mistralai @supabase/supabase-js
 */

// env.js MUST be first — it sets SUPABASE_URL before tools.js creates its client
import './env.js'

import { Mistral } from '@mistralai/mistralai'

import {
  getEmployee,
  searchEmployees,
  getCourseEnrollments,
  getComplianceAlerts,
  getHeadcountSummary,
  transferEmployee,
} from './tools.js'

import { TOOL_DEFINITIONS, toMistralTools } from './agent_config.js'

const MISTRAL_TOOL_DEFINITIONS = toMistralTools(TOOL_DEFINITIONS)

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MODEL         = 'mistral-large-latest'
const MAX_TOKENS    = 4096
const MAX_ITER      = 10
const MAX_RETRIES   = 4         // attempts after first failure
const RETRY_BASE_MS = 1000      // 1 s → 2 s → 4 s → 8 s

// ─────────────────────────────────────────────────────────────────────────────
// Tool executor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} name   Tool name from the tool_calls entry.
 * @param {object} input  Parsed arguments object.
 * @returns {Promise<object>}
 */
async function executeTool(name, input) {
  switch (name) {
    case 'getEmployee':
      return getEmployee(input.id)

    case 'searchEmployees':
      return searchEmployees({
        department:   input.department,
        status:       input.status,
        hireDateFrom: input.hireDateFrom,
        hireDateTo:   input.hireDateTo,
      })

    case 'getCourseEnrollments':
      return getCourseEnrollments(input.employee_id)

    case 'getComplianceAlerts':
      return getComplianceAlerts()

    case 'getHeadcountSummary':
      return getHeadcountSummary()

    case 'transferEmployee':
      return transferEmployee(input.employee_id, input.new_department)

    default:
      return { success: false, error: `Unknown tool: ${name}`, data: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent classifier (unchanged from Anthropic version)
// ─────────────────────────────────────────────────────────────────────────────

const CROSS_RE = [
  /\bcompliance\b/i,
  /\balert\b/i,
  /\btransfer\b/i,
  /\bmov(?:e|ing)\b.{0,30}\bto\b/i,
  /\bexpir/i,
]

const LEARNING_RE = [
  /\bcourse\b/i,
  /\benroll/i,
  /\btraining\b/i,
  /\bcertif/i,
  /\blearn/i,
  /\bcomplete[ds]?\b/i,
  /\bprogress\b/i,
  /\boverdue\b/i,
]

/**
 * @param {string}   message
 * @param {object[]} history
 * @returns {'hr' | 'learning' | 'cross'}
 */
export function classifyIntent(message, history = []) {
  const override = process.env.SMARTHRIS_INTENT
  if (override === 'hr' || override === 'learning' || override === 'cross') {
    return override
  }

  const priorContext = history
    .filter(m => m.role === 'user')
    .slice(-1)
    .map(m => (typeof m.content === 'string' ? m.content : ''))
    .join(' ')

  const text = `${priorContext} ${message}`

  if (CROSS_RE.some(re => re.test(text)))    return 'cross'
  if (LEARNING_RE.some(re => re.test(text))) return 'learning'
  return 'hr'
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-agent system prompts
// ─────────────────────────────────────────────────────────────────────────────

const RESPONSE_FORMAT = `\
## Response format
Every response MUST be a single valid JSON object with exactly two top-level fields:
  { "type": "<table|alert_list|summary|text>", "data": <object or array> }

  "table"      — any list of rows: employees, enrollments, OR department headcount
                 breakdowns. data MUST be an array of flat objects. For headcount,
                 use the by_department array directly as data (one row per dept).
  "alert_list" — compliance alerts; data has overdue_mandatory_training[] and
                 expiring_certifications[].
  "summary"    — scalar aggregates or a transfer confirmation; data is a flat object
                 with only primitive values (strings/numbers). Do NOT put arrays
                 inside a summary — use "table" instead.
  "text"       — single record, clarification, or error; data is an object or string.

For headcount queries: return type "table" with data = the by_department array.
Append a totals row as the last element if useful.

Add an "explanation" key inside data if a narrative note is needed. Never produce
prose outside this JSON envelope. Never return raw tool output verbatim.`

const HR_SYSTEM = `\
You are the SmartHRIS HR Agent for ACME Corporation. You answer questions about employee
records, profiles, department memberships, and headcount.

Name resolution: when the user names an employee without a UUID, call searchEmployees
(filtered by department if mentioned, otherwise no filters) to find their id, then call
getEmployee if a full profile is needed.

${RESPONSE_FORMAT}`

const LEARNING_SYSTEM = `\
You are the SmartHRIS Learning Agent for ACME Corporation. You answer questions about
individual training progress, course enrollments, and certification status.

Name resolution: when the user names an employee, call searchEmployees first to resolve
their UUID, then call getCourseEnrollments with that UUID.

${RESPONSE_FORMAT}`

const CROSS_SYSTEM = `\
You are SmartHRIS Assistant for ACME Corporation, handling queries that span employee
records and learning data — including org-wide compliance alerts and department transfers.

Compliance queries: call getComplianceAlerts with no arguments.

Transfer workflow:
  1. Resolve the employee UUID via searchEmployees (or getEmployee if UUID is known).
  2. Confirm the user intends to execute — not just preview — the transfer.
  3. Call transferEmployee with the confirmed UUID and target department.
  4. Return the diff as type "summary". State clearly that enrollment changes are NOT
     applied until an HR admin runs confirmTransferEnrollments separately.

${RESPONSE_FORMAT}`

// ─────────────────────────────────────────────────────────────────────────────
// Tool subset selection
// ─────────────────────────────────────────────────────────────────────────────

// Index by function name (Mistral format: tool.function.name)
const TOOL_BY_NAME = Object.fromEntries(MISTRAL_TOOL_DEFINITIONS.map(t => [t.function.name, t]))

const AGENT_TOOL_NAMES = {
  hr:       ['getEmployee', 'searchEmployees', 'getHeadcountSummary'],
  learning: ['getEmployee', 'searchEmployees', 'getCourseEnrollments'],
  cross:    [
    'getEmployee', 'searchEmployees', 'getCourseEnrollments',
    'getComplianceAlerts', 'getHeadcountSummary', 'transferEmployee',
  ],
}

function selectTools(intent) {
  return AGENT_TOOL_NAMES[intent].map(n => TOOL_BY_NAME[n]).filter(Boolean)
}

// ─────────────────────────────────────────────────────────────────────────────
// History utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strips tool-calling rounds from a full agentic message list, retaining only
 * plain-text user/assistant turns. Safe to pass as conversationHistory on the
 * next orchestrate() call regardless of which sub-agent handled the prior turn.
 *
 * Mistral-specific rules:
 *   • role:'tool'      — tool result messages, always dropped
 *   • role:'system'    — prepended inside runAgentLoop, never stored in history
 *   • role:'assistant' with toolCalls — intermediate reasoning, dropped
 *
 * @param {object[]} messages
 * @returns {object[]}
 */
export function extractCleanHistory(messages) {
  const clean = []

  for (const msg of messages) {
    if (msg.role === 'tool')   continue
    if (msg.role === 'system') continue
    if (msg.role === 'assistant' && msg.toolCalls?.length) continue

    const content = typeof msg.content === 'string' ? msg.content.trim() : ''
    if (content) {
      clean.push({ role: msg.role, content })
    }
  }

  return clean
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom error class
// ─────────────────────────────────────────────────────────────────────────────

export class OrchestratorError extends Error {
  constructor(message, code, context = {}) {
    super(message)
    this.name    = 'OrchestratorError'
    this.code    = code    // 'INVALID_INPUT' | 'API_ERROR' | 'LOOP_LIMIT'
    this.context = context
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry helper — exponential backoff for 429 rate-limit responses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls `fn` and retries on HTTP 429 with exponential backoff.
 * All other errors are re-thrown immediately.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const is429 =
        err.statusCode === 429 ||
        err.status     === 429 ||
        /429|rate.?limit/i.test(err.message)

      if (!is429 || attempt >= MAX_RETRIES) throw err

      const delay = RETRY_BASE_MS * (2 ** attempt)
      console.warn(`[retry] 429 rate-limit — waiting ${delay} ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core agentic loop
//
// Prepends the system prompt as a system message on every API call (not stored
// in `messages` so it doesn't pollute cleanHistory). Tool results are returned
// as individual role:'tool' messages rather than a bundled user turn, matching
// Mistral's expected conversation format.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Mistral}  client
 * @param {string}   system   Sub-agent system prompt.
 * @param {object[]} tools    Mistral tool definition array.
 * @param {object[]} messages Starting message list (no system message).
 * @returns {Promise<{ text: string, messages: object[] }>}
 * @throws  {OrchestratorError}
 */
async function runAgentLoop(client, system, tools, messages) {
  for (let iter = 1; iter <= MAX_ITER; iter++) {
    console.log(`[loop] iter=${iter}  history=${messages.length} turn(s)`)

    // Prepend system message on every call; it is not stored in `messages`
    const apiMessages = [{ role: 'system', content: system }, ...messages]

    let response
    try {
      response = await withRetry(() => client.chat.complete({
        model:      MODEL,
        maxTokens:  MAX_TOKENS,
        messages:   apiMessages,
        tools,
        toolChoice: 'auto',
      }))
    } catch (err) {
      throw new OrchestratorError(
        `Mistral API call failed: ${err.message}`,
        'API_ERROR',
        { iteration: iter, cause: err }
      )
    }

    const { finishReason, message } = response.choices[0]
    const { usage } = response
    console.log(
      `[loop] finishReason=${finishReason}  toolCalls=${message.toolCalls?.length ?? 0}` +
      `  in=${usage?.promptTokens ?? '?'}  out=${usage?.completionTokens ?? '?'}`
    )

    // Append the assistant turn (may include toolCalls)
    messages = [...messages, message]

    // ── Final response ──────────────────────────────────────────────────────
    if (finishReason !== 'tool_calls') {
      return { text: message.content ?? '', messages }
    }

    // ── Execute tool calls ──────────────────────────────────────────────────
    // Mistral tool call arguments arrive as a JSON string; parse before dispatch.
    const toolResults = await Promise.all(
      message.toolCalls.map(async toolCall => {
        const name = toolCall.function.name
        let input
        try {
          input = JSON.parse(toolCall.function.arguments)
        } catch {
          input = {}
        }

        console.log(`[tool] → ${name}  input=${JSON.stringify(input)}`)

        let result
        try {
          result = await executeTool(name, input)
        } catch (err) {
          console.error(`[tool] ✗ ${name}:`, err.message)
          result = { success: false, error: err.message, data: null }
        }

        console.log(`[tool] ${result.success ? '✓' : '✗'} ${name}`)

        // Each tool result is its own message in Mistral's format
        return {
          role:       'tool',
          toolCallId: toolCall.id,
          content:    JSON.stringify(result),
        }
      })
    )

    // Append all tool results; each is its own conversation turn
    messages = [...messages, ...toolResults]
  }

  console.error(`[loop] MAX_ITER (${MAX_ITER}) reached without a final response`)
  return {
    text: JSON.stringify({
      type: 'text',
      data: {
        error:       'The agent exceeded the maximum number of reasoning steps.',
        explanation: 'Please rephrase your question or break it into smaller parts.',
      },
    }),
    messages,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orchestrates a single user turn through the SmartHRIS agent system.
 *
 * @param {string}   userMessage
 * @param {object[]} [conversationHistory=[]]
 *   Pass `result.cleanHistory` from the previous call.
 *
 * @returns {Promise<{
 *   intent:       'hr' | 'learning' | 'cross',
 *   response:     string,
 *   messages:     object[],
 *   cleanHistory: object[],
 * }>}
 *
 * @throws {OrchestratorError}  code='INVALID_INPUT' | 'API_ERROR' | 'LOOP_LIMIT'
 */
export async function orchestrate(userMessage, conversationHistory = []) {
  if (!userMessage || typeof userMessage !== 'string') {
    throw new OrchestratorError('userMessage must be a non-empty string', 'INVALID_INPUT')
  }

  const cleanedHistory = extractCleanHistory(conversationHistory)

  const intent = classifyIntent(userMessage, cleanedHistory)
  const system = { hr: HR_SYSTEM, learning: LEARNING_SYSTEM, cross: CROSS_SYSTEM }[intent]
  const tools  = selectTools(intent)

  console.log(
    `[orchestrator] intent="${intent}"` +
    `  tools=[${tools.map(t => t.function.name).join(', ')}]` +
    `  query="${userMessage.slice(0, 60)}${userMessage.length > 60 ? '…' : ''}"`
  )

  const messages = [
    ...cleanedHistory,
    { role: 'user', content: userMessage },
  ]

  const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY })

  const { text, messages: updatedMessages } = await runAgentLoop(
    client, system, tools, messages
  )

  return {
    intent,
    response:     text,
    messages:     updatedMessages,
    cleanHistory: extractCleanHistory(updatedMessages),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo entry point
// Run:  node mistral_orchestrator.js
// Env:  MISTRAL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] &&
  (process.argv[1] === new URL(import.meta.url).pathname ||
   process.argv[1].endsWith('/mistral_orchestrator.js'))

if (isMain) {
  const DEMO = [
    { q: 'Show me all active employees in the Engineering department.', expectIntent: 'hr' },
    { q: "What's Aisha Patel's training status?",                       expectIntent: 'learning' },
    { q: 'Are there any compliance risks across the organisation?',     expectIntent: 'cross' },
    { q: 'Give me a headcount breakdown by department.',                expectIntent: 'hr' },
    { q: "Transfer James O'Connor to Data & Analytics.",                expectIntent: 'cross' },
  ]

  let history = []

  for (const { q, expectIntent } of DEMO) {
    console.log(`\n${'═'.repeat(72)}`)
    console.log(`USER: ${q}`)
    console.log(`${'─'.repeat(72)}`)

    try {
      const result = await orchestrate(q, history)
      const match  = result.intent === expectIntent ? '✓' : `✗ (expected ${expectIntent})`

      console.log(`INTENT:   ${result.intent} ${match}`)
      console.log(`RESPONSE: ${result.response}`)

      history = result.cleanHistory
    } catch (err) {
      console.error(`ERROR [${err.code ?? 'UNKNOWN'}]: ${err.message}`)
      if (err.context) console.error('CONTEXT:', err.context)
    }
  }
}
