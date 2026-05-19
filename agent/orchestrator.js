/**
 * SmartHRIS — AI Orchestrator
 *
 * Receives a natural-language HR query, classifies its intent, routes it to
 * the appropriate sub-agent (HR, Learning, or cross-system), drives the
 * agentic tool-calling loop with Claude until a final answer is produced, and
 * returns a structured JSON response string.
 *
 * Sub-agent tool allocation
 * ─────────────────────────
 *   HR Agent          │ getEmployee · searchEmployees · getHeadcountSummary
 *   Learning Agent    │ getEmployee · searchEmployees · getCourseEnrollments
 *   Cross-system Agent│ all six tools
 *
 * Cross-system is selected when the query involves compliance alerts,
 * department transfers, or spans both employee records and learning data.
 * Learning Agent always includes getEmployee + searchEmployees so it can
 * resolve employee names to UUIDs without a prior HR Agent call.
 *
 * Conversation history
 * ─────────────────────
 * Pass `result.cleanHistory` from the previous turn as `conversationHistory`
 * on the next call. Do NOT pass `result.messages` — it contains raw
 * tool_use / tool_result blocks that break routing across different sub-agents
 * because tool IDs from one agent are opaque to another.
 *
 * Requires:
 *   ANTHROPIC_API_KEY   — set in environment
 *   SUPABASE_URL        — set in environment (consumed by tools.js)
 *   SUPABASE_SERVICE_ROLE_KEY — set in environment (consumed by tools.js)
 *
 * Install: npm install @anthropic-ai/sdk @supabase/supabase-js
 */

// env.js MUST be first — it sets SUPABASE_URL before tools.js creates its client
import './env.js'

import Anthropic from '@anthropic-ai/sdk'

import {
  getEmployee,
  searchEmployees,
  getCourseEnrollments,
  getComplianceAlerts,
  getHeadcountSummary,
  transferEmployee,
} from './tools.js'

import { TOOL_DEFINITIONS } from './agent_config.js'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Model requested in the spec. Update to the latest snapshot if this alias
// is ever retired (current recommended: 'claude-sonnet-4-6').
const MODEL      = 'claude-sonnet-4-20250514'
const MAX_TOKENS = 4096
const MAX_ITER   = 10   // safety cap — prevents runaway tool-calling loops

// ─────────────────────────────────────────────────────────────────────────────
// Tool executor
//
// Bridges Claude's flat tool_use input schema to each JS function's call
// signature. Returns the raw { success, data, ... } object from the tool so
// Claude gets the full structured result, not a string summary.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} name   Tool name from the tool_use block.
 * @param {object} input  Input object from the tool_use block.
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
// Intent classifier
//
// Keyword-based heuristic — fast and deterministic, avoids a round-trip to
// Claude just for routing. Conservative: ambiguous queries default to 'cross'
// rather than silently dropping needed tools.
//
// Override:  set SMARTHRIS_INTENT=hr|learning|cross in env to force a route
//            (useful in tests and when the heuristic misfires).
// ─────────────────────────────────────────────────────────────────────────────

// Signals a query that spans employee data and learning data
const CROSS_RE = [
  /\bcompliance\b/i,
  /\balert\b/i,
  /\btransfer\b/i,
  /\bmov(?:e|ing)\b.{0,30}\bto\b/i,   // "move Alice to Engineering"
  /\bexpir/i,                           // "expiring certifications"
]

// Signals a pure learning/training query
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
 * Classifies the query into a routing target.
 *
 * @param {string}   message  Current user turn.
 * @param {object[]} history  Prior clean text turns (used for follow-up context).
 * @returns {'hr' | 'learning' | 'cross'}
 */
export function classifyIntent(message, history = []) {
  // Allow env-level override for testing / edge cases
  const override = process.env.SMARTHRIS_INTENT
  if (override === 'hr' || override === 'learning' || override === 'cross') {
    return override
  }

  // Include the last prior user turn to handle follow-up questions
  // e.g. "What about her training?" after asking about an employee
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

  "table"      — ordered list of employee or enrollment rows; data is an array.
  "alert_list" — compliance alerts; data has overdue_mandatory_training[] and
                 expiring_certifications[].
  "summary"    — aggregate counts or a transfer confirmation; data is an object.
  "text"       — single record, clarification, or error; data is an object or string.

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

// Index all tool definitions by name for O(1) lookup
const TOOL_BY_NAME = Object.fromEntries(TOOL_DEFINITIONS.map(t => [t.name, t]))

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
 * Strips tool_use / tool_result blocks from a full agentic message list,
 * retaining only plain-text turns. The result is safe to pass as
 * conversationHistory on the next orchestrate() call, even if the intent
 * routes to a different sub-agent with a different tool set.
 *
 * @param {object[]} messages  Full message list from runAgentLoop.
 * @returns {object[]}         Clean history with text content only.
 */
export function extractCleanHistory(messages) {
  const clean = []

  for (const msg of messages) {
    // Already a plain string (e.g. passed in from a previous clean history)
    if (typeof msg.content === 'string' && msg.content.trim()) {
      clean.push({ role: msg.role, content: msg.content })
      continue
    }

    if (Array.isArray(msg.content)) {
      // Drop any turn that contains a tool_use or tool_result block — even if
      // it also has a text block alongside it. Such turns are intermediate
      // reasoning rounds, not final answers. Including them creates consecutive
      // same-role turns that violate the Claude API's alternating-turn contract.
      const hasToolBlock = msg.content.some(
        b => b.type === 'tool_use' || b.type === 'tool_result'
      )
      if (hasToolBlock) continue

      const textBlocks = msg.content.filter(b => b.type === 'text')
      if (textBlocks.length > 0) {
        clean.push({
          role:    msg.role,
          content: textBlocks.map(b => b.text).join('\n'),
        })
      }
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
// Core agentic loop
//
// Sends messages to Claude with the selected tools. If Claude returns a
// tool_use block, all tool calls in that response are executed in parallel,
// their results are appended as a user turn, and the loop continues. Stops
// when stop_reason is not 'tool_use' (typically 'end_turn') or MAX_ITER
// is reached.
//
// Tool calls within a single response round are always parallelised with
// Promise.all. Individual tool failures are caught and returned as
// { success: false, error } so Claude can reason about them rather than
// causing the whole loop to abort.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Anthropic}  client   Initialised Anthropic SDK instance.
 * @param {string}     system   Sub-agent system prompt.
 * @param {object[]}   tools    Claude API tool definition array.
 * @param {object[]}   messages Starting message list.
 * @returns {Promise<{ text: string, messages: object[] }>}
 * @throws  {OrchestratorError}  On API errors.
 */
async function runAgentLoop(client, system, tools, messages) {
  for (let iter = 1; iter <= MAX_ITER; iter++) {
    console.log(`[loop] iter=${iter}  history=${messages.length} turn(s)`)

    // ── Claude API call ─────────────────────────────────────────────────────
    let response
    try {
      response = await client.messages.create({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system,
        tools,
        messages,
      })
    } catch (err) {
      // Wrap Anthropic SDK errors so callers get a consistent error type
      throw new OrchestratorError(
        `Claude API call failed: ${err.message}`,
        'API_ERROR',
        { iteration: iter, cause: err }
      )
    }

    const { stop_reason, content, usage } = response
    console.log(
      `[loop] stop_reason=${stop_reason}  blocks=${content.length}` +
      `  in=${usage?.input_tokens ?? '?'}  out=${usage?.output_tokens ?? '?'}`
    )

    // Always append the assistant turn before deciding what to do next
    messages = [...messages, { role: 'assistant', content }]

    // ── Final response (no tool calls) ──────────────────────────────────────
    if (stop_reason !== 'tool_use') {
      const textBlock = content.find(b => b.type === 'text')
      return { text: textBlock?.text ?? '', messages }
    }

    // ── Execute tool calls ──────────────────────────────────────────────────
    const toolUseBlocks = content.filter(b => b.type === 'tool_use')

    // Run all tool calls in this round concurrently
    const toolResults = await Promise.all(
      toolUseBlocks.map(async block => {
        console.log(`[tool] → ${block.name}  input=${JSON.stringify(block.input)}`)

        let result
        try {
          result = await executeTool(block.name, block.input)
        } catch (err) {
          // Tool threw unexpectedly — return an error object so Claude can
          // report it rather than crashing the loop
          console.error(`[tool] ✗ ${block.name}:`, err.message)
          result = { success: false, error: err.message, data: null }
        }

        const status = result.success ? '✓' : '✗'
        console.log(`[tool] ${status} ${block.name}`)

        return {
          type:        'tool_result',
          tool_use_id: block.id,
          content:     JSON.stringify(result),
        }
      })
    )

    // Append tool results as the next user turn and loop
    messages = [...messages, { role: 'user', content: toolResults }]
  }

  // ── Loop limit exceeded ─────────────────────────────────────────────────
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
 *   The user's natural-language query.
 *
 * @param {object[]} [conversationHistory=[]]
 *   Prior text-only turns in Claude message format:
 *     [{ role: 'user'|'assistant', content: string }, ...]
 *   Pass `result.cleanHistory` from the previous call. Do NOT pass
 *   `result.messages` — it contains tool_use blocks from a previous sub-agent
 *   that would cause an API error if the intent routes to a different agent.
 *
 * @returns {Promise<{
 *   intent:       'hr' | 'learning' | 'cross',
 *   response:     string,    // structured JSON string — parse for display
 *   messages:     object[],  // full agentic history (tool calls included)
 *   cleanHistory: object[],  // text-only history — pass this next turn
 * }>}
 *
 * @throws {OrchestratorError}  code='INVALID_INPUT' | 'API_ERROR' | 'LOOP_LIMIT'
 *
 * @example
 *   let history = []
 *   const r1 = await orchestrate("Show active Engineering employees")
 *   console.log(JSON.parse(r1.response))
 *
 *   const r2 = await orchestrate("What's Jennifer's training status?", r1.cleanHistory)
 *   console.log(JSON.parse(r2.response))
 */
export async function orchestrate(userMessage, conversationHistory = []) {
  if (!userMessage || typeof userMessage !== 'string') {
    throw new OrchestratorError('userMessage must be a non-empty string', 'INVALID_INPUT')
  }

  // Defensive sanitise — callers might accidentally pass result.messages
  // instead of result.cleanHistory; strip any tool blocks before use
  const cleanedHistory = extractCleanHistory(
    conversationHistory.map(m =>
      typeof m.content === 'string'
        ? m
        : { ...m, content: Array.isArray(m.content) ? m.content : [] }
    )
  )

  // 1. Classify intent → select sub-agent
  const intent = classifyIntent(userMessage, cleanedHistory)
  const system = { hr: HR_SYSTEM, learning: LEARNING_SYSTEM, cross: CROSS_SYSTEM }[intent]
  const tools  = selectTools(intent)

  console.log(
    `[orchestrator] intent="${intent}"` +
    `  tools=[${tools.map(t => t.name).join(', ')}]` +
    `  query="${userMessage.slice(0, 60)}${userMessage.length > 60 ? '…' : ''}"`
  )

  // 2. Build message list: history + new user turn
  const messages = [
    ...cleanedHistory,
    { role: 'user', content: userMessage },
  ]

  // 3. Initialise SDK client (reads ANTHROPIC_API_KEY from process.env)
  const client = new Anthropic()

  // 4. Run agentic loop
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
// Run:  node orchestrator.js
// Env:  ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] &&
  (process.argv[1] === new URL(import.meta.url).pathname ||
   process.argv[1].endsWith('/orchestrator.js'))

if (isMain) {
  // Five queries that exercise each routing path and multi-step tool chains
  const DEMO = [
    // HR Agent — single tool call
    { q: 'Show me all active employees in the Engineering department.', expectIntent: 'hr' },
    // Learning Agent — two-step: searchEmployees → getCourseEnrollments
    { q: "What's Aisha Patel's training status?",                       expectIntent: 'learning' },
    // Cross-system Agent — single tool call
    { q: 'Are there any compliance risks across the organisation?',     expectIntent: 'cross' },
    // HR Agent — single tool call
    { q: 'Give me a headcount breakdown by department.',                expectIntent: 'hr' },
    // Cross-system Agent — two-step: searchEmployees → transferEmployee
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

      // Carry the clean text history forward into the next turn
      history = result.cleanHistory
    } catch (err) {
      console.error(`ERROR [${err.code ?? 'UNKNOWN'}]: ${err.message}`)
      if (err.context) console.error('CONTEXT:', err.context)
    }
  }
}
