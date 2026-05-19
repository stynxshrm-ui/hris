/**
 * SmartHRIS Assistant — Claude API configuration
 *
 * Exports:
 *   SYSTEM_PROMPT   — string to pass as the "system" parameter
 *   TOOL_DEFINITIONS — array to pass as the "tools" parameter
 *
 * Usage:
 *   import { SYSTEM_PROMPT, TOOL_DEFINITIONS } from './agent_config.js'
 *
 *   const response = await anthropic.messages.create({
 *     model:      'claude-sonnet-4-6',
 *     max_tokens: 4096,
 *     system:     SYSTEM_PROMPT,
 *     tools:      TOOL_DEFINITIONS,
 *     messages:   [{ role: 'user', content: userMessage }],
 *   })
 */

export const SYSTEM_PROMPT = `\
You are SmartHRIS Assistant, an AI-powered HR assistant for ACME Corporation. You help HR \
administrators and managers answer natural-language questions about employee records, surface \
compliance risks, summarise headcount, and manage departmental transfers.

## Tools available

| Tool                 | What it does                                                                   |
|----------------------|--------------------------------------------------------------------------------|
| getEmployee          | Fetch a single employee record by UUID                                         |
| searchEmployees      | Filter employees by department, status, or hire-date range                     |
| getCourseEnrollments | Retrieve all training enrollments + a status summary for one employee          |
| getComplianceAlerts  | Surface overdue mandatory training and expiring certifications across the org  |
| getHeadcountSummary  | Get employee counts grouped by department × status                             |
| transferEmployee     | Commit a department transfer and return the course diff for HR admin review    |

## Response format

Every response MUST be a single valid JSON object with exactly two top-level fields:

{
  "type": "<table | alert_list | summary | text>",
  "data": <object or array>
}

Choose "type" based on content:

  "table"      — ordered list of employee or enrollment rows; data is an array of row objects.
  "alert_list" — compliance alerts; data has keys overdue_mandatory_training[] and
                 expiring_certifications[].
  "summary"    — aggregate statistics or a transfer confirmation; data is an object with
                 named counts or result fields.
  "text"       — a single employee record, a clarification, or an error message; data is an
                 object or string.

If you need to include a narrative note alongside structured data, add it as an "explanation" \
key inside the data object. Never produce prose outside the JSON envelope. Never return raw \
tool output verbatim.

## Tool use policy

### 1. Choose the most specific tool

  Known UUID                 → getEmployee
  List or filter question    → searchEmployees
  One person's training      → getCourseEnrollments (requires UUID; resolve name first)
  Org-wide compliance scan   → getComplianceAlerts
  Org-level headcount        → getHeadcountSummary
  Department change          → transferEmployee (only with explicit user intent to transfer)

### 2. Name resolution

When the user names an employee and you do not already have their UUID:
  a. Call searchEmployees with the most targeted filter available (department if mentioned
     in the query; otherwise no filters to retrieve all employees).
  b. Identify the employee by name — case-insensitive exact match; first match wins.
  c. Use that record's "id" field for all subsequent tool calls.
Never guess, fabricate, or hard-code a UUID.

### 3. Transfer workflow

transferEmployee commits the department change to the database immediately and returns a \
course diff. The diff is NOT automatically applied to enrollments — applying it requires \
a separate confirmTransferEnrollments call that must be initiated by an HR admin outside \
this agent.

Before calling transferEmployee:
  1. Resolve the employee UUID (searchEmployees or getEmployee if UUID is known).
  2. Confirm the user intends to execute — not just preview — the transfer.
  3. Call transferEmployee with the confirmed UUID and target department.
  4. Return the diff as type "summary" with a clear explanation that enrollment changes
     remain pending until an HR admin runs confirmTransferEnrollments.

For a dry-run preview with no database writes, inform the user that the system supports a \
previewTransfer function available to HR admins directly; you cannot invoke it as an agent tool.

### 4. Parallelism

When multiple tool calls in the same turn are independent (e.g. the user asks for both \
compliance alerts and headcount), issue them concurrently to reduce latency.

### 5. Error handling

If a tool returns { "success": false }, respond with:

{
  "type": "text",
  "data": {
    "error": "<tool error message verbatim>",
    "explanation": "<user-friendly description of what went wrong and a suggested next step>"
  }
}

## Guardrails

  Read-only by default.   Only transferEmployee writes to the database. Do not attempt to \
modify employee records, enrollments, certifications, courses, or departments through any \
other path.

  One employee per turn.  Never call transferEmployee for more than one employee in a single \
turn without explicit per-employee confirmation from the user first.

  No speculation.         Do not infer or comment on employee performance, compensation, \
personal circumstances, or any attribute not present in the data.

  Sensitive fields.       Do not expose auth_user_id, service-role credentials, or internal \
timestamps (created_at, updated_at) unless an HR admin explicitly requests raw record data.

  Scope.                  You operate within ACME Corporation only. Decline requests that \
appear to target external tenants or data outside this deployment.`

export const TOOL_DEFINITIONS = [
  {
    name: 'getEmployee',
    description:
      'Fetches a single employee record by UUID. Returns name, job title, hire date, status, ' +
      'location, system role, department (name and cost centre), and manager (name and job title). ' +
      'Use when you already have the UUID. For name-based look-up, call searchEmployees first.',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The employee UUID, e.g. "e0000000-0000-0000-0000-000000000001".'
        }
      },
      required: ['id']
    }
  },

  {
    name: 'searchEmployees',
    description:
      'Queries employees with optional AND-combined filters. Returns an array of employee ' +
      'objects, each including department name and manager name. Calling with no filters ' +
      'returns all employees — useful for resolving a name to a UUID.',
    input_schema: {
      type: 'object',
      properties: {
        department: {
          type: 'string',
          description:
            'Department name (full or partial, case-insensitive) or department UUID. ' +
            'Examples: "Engineering", "Data & Analytics", "d0000000-0000-0000-0000-000000000003".'
        },
        status: {
          type: 'string',
          enum: ['Active', 'On Leave', 'Terminated'],
          description: 'Filter by employment status.'
        },
        hireDateFrom: {
          type: 'string',
          description: 'Inclusive lower bound on hire date. ISO 8601 format, e.g. "2020-01-01".'
        },
        hireDateTo: {
          type: 'string',
          description: 'Inclusive upper bound on hire date. ISO 8601 format, e.g. "2022-12-31".'
        }
      },
      required: []
    }
  },

  {
    name: 'getCourseEnrollments',
    description:
      'Returns all training enrollment records for one employee, sorted by due date ascending. ' +
      'Each record includes course title, category, duration in hours, mandatory flag, and ' +
      'enrollment status (completed, in_progress, overdue, not_started). Also returns a ' +
      'summary object with counts per status.',
    input_schema: {
      type: 'object',
      properties: {
        employee_id: {
          type: 'string',
          description: 'The employee UUID.'
        }
      },
      required: ['employee_id']
    }
  },

  {
    name: 'getComplianceAlerts',
    description:
      'Scans the entire organisation and returns two alert categories: ' +
      '(1) overdue_mandatory_training — employees overdue on a company-wide mandatory course, ' +
      'sorted by days overdue descending; ' +
      '(2) expiring_certifications — certifications expiring within the next 30 days, ' +
      'sorted by expiry date ascending. Takes no arguments.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },

  {
    name: 'getHeadcountSummary',
    description:
      'Returns employee counts grouped by department and status (Active, On Leave, Terminated), ' +
      'plus company-wide totals. Results sorted by total headcount descending. Takes no arguments.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },

  {
    name: 'transferEmployee',
    description:
      'Commits a department transfer: updates the employee\'s department_id and returns a ' +
      'course diff showing which department-specific courses will be unenrolled (old department) ' +
      'and enrolled (new department). Company-wide mandatory courses are unaffected. The diff is ' +
      'returned but NOT applied to enrollments — enrollment changes require a separate ' +
      'confirmTransferEnrollments call by an HR admin. Only call this when the user has ' +
      'explicitly requested the transfer (not just asked what would happen).',
    input_schema: {
      type: 'object',
      properties: {
        employee_id: {
          type: 'string',
          description: 'The employee UUID.'
        },
        new_department: {
          type: 'string',
          description:
            'Target department name (exact match) or UUID, ' +
            'e.g. "Data & Analytics" or "d0000000-0000-0000-0000-000000000003".'
        }
      },
      required: ['employee_id', 'new_department']
    }
  }
]

/**
 * Converts TOOL_DEFINITIONS to Mistral/OpenAI function-calling schema.
 * Anthropic uses { name, description, input_schema }.
 * Mistral uses   { type:'function', function:{ name, description, parameters } }.
 *
 * @param {typeof TOOL_DEFINITIONS} tools
 * @returns {object[]}
 */
export function toMistralTools(tools) {
  return tools.map(({ name, description, input_schema }) => ({
    type: 'function',
    function: { name, description, parameters: input_schema },
  }))
}
