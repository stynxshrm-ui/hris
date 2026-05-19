/**
 * Environment loader — import this as the FIRST import in any entry-point
 * module. It must run before tools.js, which creates the Supabase client
 * at module load time using process.env.SUPABASE_URL.
 *
 * Loads: <project-root>/.env.local
 *
 * Also aliases NEXT_PUBLIC_SUPABASE_URL → SUPABASE_URL so the same .env.local
 * works for both the Next.js frontend (which needs the NEXT_PUBLIC_ prefix)
 * and the Node.js agent layer (which uses the bare SUPABASE_URL name).
 */

import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))

// .env.local lives one level above the agent/ directory
dotenv.config({ path: resolve(__dirname, '../.env.local') })

// Alias: the frontend uses NEXT_PUBLIC_SUPABASE_URL; the agent tools.js reads
// SUPABASE_URL. If only the prefixed form exists, create the bare alias.
if (!process.env.SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
}
