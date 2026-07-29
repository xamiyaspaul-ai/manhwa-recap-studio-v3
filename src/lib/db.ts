import { PrismaClient } from '@prisma/client'

/**
 * Prisma client with Turso (libsql) support.
 *
 * - Local dev / sandbox: DATABASE_URL is a file: path → standard SQLite Prisma.
 * - Vercel / serverless: DATABASE_URL is a libsql:// URL (Turso) → use the
 *   PrismaLibSQL adapter so Prisma talks to Turso's HTTP-based protocol.
 *
 * Turso is a free hosted SQLite (9 GB free tier, edge-replicated) that works
 * perfectly with this app's existing schema — no migration needed.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || ''

  // Turso / libsql — used when deployed to Vercel or any serverless host.
  if (url.startsWith('libsql://') || url.startsWith('http://') || url.startsWith('https://')) {
    // Lazy-import the adapter so local dev (plain SQLite) doesn't require it.
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

  // Local SQLite file (sandbox / laptop dev).
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
