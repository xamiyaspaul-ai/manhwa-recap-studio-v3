import { PrismaClient } from '@prisma/client'

/**
 * Prisma client with multi-database support.
 *
 * Supports 3 database backends, auto-detected from DATABASE_URL:
 *
 * 1. Local SQLite (sandbox / laptop dev):
 *    DATABASE_URL = file:/path/to/db.sqlite
 *    → Standard PrismaClient with SQLite provider
 *
 * 2. Turso (free hosted SQLite, 9 GB):
 *    DATABASE_URL = libsql://xxx.turso.io
 *    → PrismaLibSQL adapter (HTTP-based, edge-replicated)
 *
 * 3. Supabase (free hosted PostgreSQL, 500 MB):
 *    DATABASE_URL = postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres
 *    → Standard PrismaClient with PostgreSQL provider
 *
 * Both Turso and Supabase have free tiers. Supabase gives you a full PostgreSQL
 * database with dashboard, auth, real-time, and storage. Turso is simpler
 * (SQLite-compatible, no schema changes needed).
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || ''

  // Option 1: Turso / libsql
  if (url.startsWith('libsql://') || url.startsWith('http://') || url.startsWith('https://')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSQL } = require('@prisma/adapter-libsql')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('@libsql/client')
    const libsql = createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }

  // Option 2: Supabase / PostgreSQL
  // Prisma natively supports PostgreSQL — no adapter needed.
  // Just set DATABASE_URL to the Supabase connection string and
  // change the schema.prisma provider to "postgresql".
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query'],
      // Prisma reads DATABASE_URL directly from env for PostgreSQL
    })
  }

  // Option 3: Local SQLite file (sandbox / laptop dev)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
