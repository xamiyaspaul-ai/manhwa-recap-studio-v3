/**
 * lib.ts — shared helpers for the pipeline-service.
 *
 * Contains:
 *  - Prisma client (single instance)
 *  - Path helpers (hardcoded to the parent app's data dir)
 *  - MangaDex fetch helpers (chapter pages, image download)
 *  - VLM helper (z-ai-web-dev-sdk) for generating chapter summaries
 *  - Small utility helpers (sleep, ensureDir, fileExists, sanitize)
 */

import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Prisma — single shared client pointing at the same SQLite DB.
// Supports both local file: SQLite (laptop/sandbox) and libsql:// Turso
// (when the Next.js app is deployed to Vercel and shares a Turso DB).
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as { pipelinePrisma: PrismaClient | undefined }

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || ''
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
  return new PrismaClient({ log: ['error', 'warn'] })
}

export const db = globalForPrisma.pipelinePrisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.pipelinePrisma = db

// ---------------------------------------------------------------------------
// Paths — env-configurable so the mini-service can run anywhere (laptop, VPS,
// etc.), not just the original sandbox. Defaults preserve the original
// /home/z/my-project layout for backwards compatibility.
// ---------------------------------------------------------------------------

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : '/home/z/my-project/data'
// Pipeline script lives next to the parent app; resolve via PROJECT_ROOT if set,
// otherwise fall back to the known sandbox location.
const PROJECT_ROOT = process.env.PROJECT_ROOT || '/home/z/my-project'
export { PROJECT_ROOT }
export const PIPELINE_SCRIPT = path.join(PROJECT_ROOT, 'pipeline', 'master_pipeline.py')
export const PYTHON_BIN = process.env.PYTHON_BIN || 'python3'

export function jobDir(jobId: string): string {
  return path.join(DATA_DIR, 'jobs', jobId)
}
export function datasetDir(jobId: string): string {
  return path.join(jobDir(jobId), 'dataset')
}
export function workDir(jobId: string): string {
  return path.join(jobDir(jobId), 'work')
}
export function outputDir(jobId: string): string {
  return path.join(jobDir(jobId), 'output')
}
export function chapterDir(jobId: string, index: number): string {
  return path.join(datasetDir(jobId), `chapter_${String(index).padStart(3, '0')}`)
}
export function outputVideoPath(jobId: string): string {
  return path.join(outputDir(jobId), 'master_recap.mp4')
}
export function progressFilePath(jobId: string): string {
  return path.join(jobDir(jobId), 'progress.json')
}

export async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true })
}

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ---------------------------------------------------------------------------
// Caching: JSON file cache for VLM transcription results.
// Saves to data/cache/vlm/{hash}.json with a 1-hour TTL.
// On re-runs (e.g. after a render failure), cached VLM results are reused
// instantly — huge savings since VLM calls are the bottleneck.
// ---------------------------------------------------------------------------

import crypto from 'crypto'

const VLM_CACHE_DIR = path.join(DATA_DIR, 'cache', 'vlm')
const VLM_CACHE_TTL_MS = 3600 * 1000 // 1 hour

function vlmCacheKey(imagePath: string): string {
  return crypto.createHash('sha256').update(imagePath).digest('hex').slice(0, 16)
}

async function getVlmCached(key: string): Promise<string | null> {
  try {
    const cacheFile = path.join(VLM_CACHE_DIR, `${key}.json`)
    const stat = await fs.stat(cacheFile)
    if (Date.now() - stat.mtimeMs > VLM_CACHE_TTL_MS) return null
    const data = JSON.parse(await fs.readFile(cacheFile, 'utf8'))
    return data.text ?? null
  } catch {
    return null
  }
}

async function setVlmCached(key: string, text: string): Promise<void> {
  try {
    await fs.mkdir(VLM_CACHE_DIR, { recursive: true })
    await fs.writeFile(
      path.join(VLM_CACHE_DIR, `${key}.json`),
      JSON.stringify({ text, ts: Date.now() }),
      'utf8',
    )
  } catch {
    // non-fatal
  }
}

// ---------------------------------------------------------------------------
// Credit/author/website panel detection.
// Manhwa chapters often start or end with "credits" panels that mention the
// scanlation group, translator, website, Discord, Patreon, etc. These are
// not part of the story and shouldn't be narrated. This function detects
// them by looking for common credit-related keywords in the transcribed text.
// ---------------------------------------------------------------------------

const CREDIT_PATTERNS: RegExp[] = [
  /scanlat/i,        // scanlation, scanlator
  /translat(?:ed|or|ion)\s+by/i,  // "translated by", "translator"
  /typeset(?:ting|ter)\s+by/i,    // "typesetting by"
  /proofread(?:er|ing)?\s+by/i,   // "proofreader by"
  /redraw(?:n|er|ing)?\s+by/i,    // "redrawn by"
  /clean(?:er|ing)\s+by/i,        // "cleaner by"
  /raw\s+(?:provider|by)/i,       // "raw provider"
  /discord(?:\.gg)?/i,            // discord links
  /patreon/i,
  /paypal/i,
  /ko-?fi/i,
  /buymeacoffee/i,
  /donate/i,
  /support\s+(?:us|the\s+(?:team|scanlat))/i,
  /join\s+(?:our\s+)?(?:discord|server)/i,
  /follow\s+(?:us|on)/i,
  /@[\w-]+\s*(?:on\s+)?(?:twitter|insta|tiktok|youtube)/i,  // social handles
  /website\s*:/i,
  /visit\s+(?:our\s+)?(?:site|website)/i,
  /please\s+(?:wait|don.?t\s+re-?upload|do\s+not\s+re-?upload)/i,
  /re-?upload/i,
  /aggregator/i,
  /chapter\s+end/i,        // "chapter end" credits
  /end\s+of\s+chapter/i,
  /next\s+chapter/i,       // "next chapter" teaser
  /coming\s+soon/i,
  /credit\s+(?:to|goes)/i, // "credit to"
  /special\s+thanks/i,
  /powered\s+by/i,
]

/**
 * Check if a panel's transcribed text indicates it's a credits/author/website
 * panel (not part of the story). Returns true if the text matches any credit
 * pattern, false otherwise.
 *
 * Used to filter out non-story panels so they're never narrated or shown
 * (they'd just waste screen time and confuse the viewer).
 */
export function isCreditPanel(text: string): boolean {
  if (!text || !text.trim()) return false
  const lower = text.toLowerCase()
  // Require at least one credit keyword. Short texts (like single sound
  // effects) won't match, so real story dialogue is safe.
  for (const pattern of CREDIT_PATTERNS) {
    if (pattern.test(lower)) {
      return true
    }
  }
  return false
}

/**
 * Filter an array of {image, text} narrations, removing credit panels.
 * Returns { filtered, creditsRemoved } where filtered is the narration array
 * with credit panels set to empty text (so the frame is skipped during render)
 * and creditsRemoved is the count of removed panels.
 *
 * We set text to empty rather than removing the entry entirely, so the frame
 * indices stay aligned with the Python render step's frame list.
 */
export function filterCreditPanels(
  narrations: Array<{ image: string; text: string }>,
): { filtered: Array<{ image: string; text: string }>; creditsRemoved: number } {
  let creditsRemoved = 0
  const filtered = narrations.map((n) => {
    if (isCreditPanel(n.text)) {
      creditsRemoved++
      return { ...n, text: '' } // empty = silent/skipped during render
    }
    return n
  })
  return { filtered, creditsRemoved }
}

// ---------------------------------------------------------------------------
// Multi-source scraping helpers (MangaHere + FanFox + Webtoons + AsuraScans).
// ---------------------------------------------------------------------------

// --- Source dispatchers ---

export type ScraperSource = 'mangahere' | 'fanfox' | 'webtoons' | 'asurascans'

export function getSourceFromId(id: string): ScraperSource | null {
  if (id.startsWith('mh-')) return 'mangahere'
  if (id.startsWith('ff-')) return 'fanfox'
  if (id.startsWith('wt-')) return 'webtoons'
  if (id.startsWith('as-')) return 'asurascans'
  return null
}

export function getSlugFromId(id: string): string {
  return id.replace(/^(mh-|ff-|wt-|as-)/, '')
}

// --- MangaHere (mangahere.cc) ---

const MANGAHERE_BASE = 'https://www.mangahere.cc'
const MANGAHERE_CDN = 'https://zjcdn.mangahere.org'

/**
 * Fetch the chapter list for a manga from MangaHere.
 * mangaId is the MangaHere slug (e.g. "solo_leveling").
 * Returns chapters oldest-first.
 */
export async function fetchMangaHereChapters(
  mangaSlug: string,
  chapterLimit: number,
): Promise<
  Array<{
    mangadexId: string // chapter slug e.g. "c001" (kept as mangadexId for DB compat)
    chapterNum: string | null
    title: string | null
    language: string
    pageCount: number
    external: boolean
  }>
> {
  const url = `${MANGAHERE_BASE}/manga/${mangaSlug}/`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) {
    throw new Error(`MangaHere chapters ${res.status} for ${mangaSlug}`)
  }
  const html = await res.text()

  // Parse chapter links: href="/manga/{slug}/c{chapter}/1.html"
  const chapters: Array<{
    mangadexId: string
    chapterNum: string | null
    title: string | null
    language: string
    pageCount: number
    external: boolean
  }> = []
  const seen = new Set<string>()
  const chapterRegex = new RegExp(
    `href="/manga/${mangaSlug}/((?:v\\d+/)?c[0-9.]+)/1\\.html"`,
    'gi',
  )
  let match
  while ((match = chapterRegex.exec(html)) !== null) {
    const chapSlug = match[1]
    if (seen.has(chapSlug)) continue
    seen.add(chapSlug)
    const chapterNum = chapSlug.match(/c([0-9.]+)/) ? (chapSlug.match(/c([0-9.]+)/)![1].replace(/^0+/, '') || '0') : '0'
    chapters.push({
      mangadexId: chapSlug,
      chapterNum,
      title: null,
      language: 'en',
      pageCount: 0,
      external: false,
    })
  }

  // MangaHere returns newest-first; reverse to oldest-first.
  chapters.reverse()

  // Apply chapter limit (0 = all).
  const limited = chapterLimit > 0 ? chapters.slice(0, chapterLimit) : chapters
  return limited
}

/**
 * Extract all image URLs for a MangaHere chapter by scraping the chapter page HTML.
 *
 * MangaHere loads images via obfuscated JavaScript. The image filenames are
 * embedded in the HTML as pipe-separated values. We extract them and construct
 * full CDN URLs.
 */
export async function fetchMangaHereChapterImages(
  mangaSlug: string,
  chapterSlug: string,
): Promise<string[]> {
  const url = `${MANGAHERE_BASE}/manga/${mangaSlug}/${chapterSlug}/1.html`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) {
    throw new Error(`MangaHere chapter ${res.status} for ${mangaSlug}/${chapterSlug}`)
  }
  const html = await res.text()

  // Extract store ID from cover image URL: store/manga/{storeId}/cover.jpg
  const storeMatch = html.match(/store\/manga\/(\d+)/)
  const storeId = storeMatch?.[1]
  if (!storeId) {
    throw new Error(`Could not extract store ID from ${url}`)
  }

  // Extract chapter folder from chapter slug: "v72/c700" → "700", "c001" → "001", "c200.5" → "200.5"
  const chapterMatch = chapterSlug.match(/c([0-9.]+)/)
  const chapterFolder = chapterMatch
    ? chapterMatch[1].padStart(3, '0')
    : chapterSlug.replace(/^c/, '').padStart(3, '0')

  // Extract image filenames from obfuscated JavaScript.
  // Pattern: {letter}{date}_{time}_{number} e.g. h20181105_144325_927
  const filenameRegex = /([a-z]\d{8}_\d{6}_[a-z0-9]+)/gi
  const filenames = new Set<string>()
  let m
  while ((m = filenameRegex.exec(html)) !== null) {
    filenames.add(m[1])
  }

  if (filenames.size === 0) {
    throw new Error(`No image filenames found in ${url}`)
  }

  // Construct full CDN URLs
  const imageUrls = Array.from(filenames).map(
    (fn) =>
      `${MANGAHERE_CDN}/store/manga/${storeId}/${chapterFolder}.0/compressed/${fn}.jpg`,
  )

  return imageUrls
}

/**
 * Download a single MangaHere image to disk.
 * CRITICAL: MangaHere CDN requires `Referer: https://www.mangahere.cc/` header.
 */
export async function downloadMangaHereImage(
  imageUrl: string,
  destPath: string,
): Promise<void> {
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: `${MANGAHERE_BASE}/`,
      Accept: 'image/*',
    },
  })
  if (!res.ok) {
    throw new Error(`MangaHere image download ${res.status}: ${imageUrl}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(destPath, buf)
}

/**
 * Get the extension from a filename, e.g. "x01.jpg" -> ".jpg".
 */
export function extFromFilename(filename: string): string {
  const m = filename.match(/\.(jpe?g|png|webp|gif)$/i)
  return m ? `.${m[1].toLowerCase()}` : '.jpg'
}

// --- FanFox (fanfox.net) — same CMS as MangaHere, different CDN ---

const FANFOX_BASE = 'https://fanfox.net'
const FANFOX_CDN = 'https://fmcdn.mfcdn.net'

export async function fetchFanFoxChapters(
  mangaSlug: string,
  chapterLimit: number,
): Promise<
  Array<{
    mangadexId: string
    chapterNum: string | null
    title: string | null
    language: string
    pageCount: number
    external: boolean
  }>
> {
  const url = `${FANFOX_BASE}/manga/${mangaSlug}/`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) {
    throw new Error(`FanFox chapters ${res.status} for ${mangaSlug}`)
  }
  const html = await res.text()

  const chapters: Array<{
    mangadexId: string
    chapterNum: string | null
    title: string | null
    language: string
    pageCount: number
    external: boolean
  }> = []
  const seen = new Set<string>()
  const chapterRegex = new RegExp(
    `href="/manga/${mangaSlug}/((?:v\\d+/)?c[0-9.]+)/1\\.html"`,
    'gi',
  )
  let match
  while ((match = chapterRegex.exec(html)) !== null) {
    const chapSlug = match[1]
    if (seen.has(chapSlug)) continue
    seen.add(chapSlug)
    const chapterNum = chapSlug.match(/c([0-9.]+)/) ? (chapSlug.match(/c([0-9.]+)/)![1].replace(/^0+/, '') || '0') : '0'
    chapters.push({
      mangadexId: chapSlug,
      chapterNum,
      title: null,
      language: 'en',
      pageCount: 0,
      external: false,
    })
  }
  chapters.reverse()
  return chapterLimit > 0 ? chapters.slice(0, chapterLimit) : chapters
}

export async function fetchFanFoxChapterImages(
  mangaSlug: string,
  chapterSlug: string,
): Promise<string[]> {
  const url = `${FANFOX_BASE}/manga/${mangaSlug}/${chapterSlug}/1.html`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) {
    throw new Error(`FanFox chapter ${res.status} for ${mangaSlug}/${chapterSlug}`)
  }
  const html = await res.text()

  const storeMatch = html.match(/store\/manga\/(\d+)/)
  const storeId = storeMatch?.[1]
  if (!storeId) {
    throw new Error(`Could not extract store ID from ${url}`)
  }
  const ffChapMatch = chapterSlug.match(/c([0-9.]+)/)
  const chapterFolder = ffChapMatch
    ? ffChapMatch[1].padStart(3, '0')
    : chapterSlug.replace(/^c/, '').padStart(3, '0')

  const filenameRegex = /([a-z]\d{8}_\d{6}_[a-z0-9]+)/gi
  const filenames = new Set<string>()
  let m
  while ((m = filenameRegex.exec(html)) !== null) {
    filenames.add(m[1])
  }

  if (filenames.size === 0) {
    throw new Error(`No image filenames found in ${url}`)
  }

  return Array.from(filenames).map(
    (fn) =>
      `${FANFOX_CDN}/store/manga/${storeId}/${chapterFolder}.0/compressed/${fn}.jpg`,
  )
}

export async function downloadFanFoxImage(
  imageUrl: string,
  destPath: string,
): Promise<void> {
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: `${FANFOX_BASE}/`,
      Accept: 'image/*',
    },
  })
  if (!res.ok) {
    throw new Error(`FanFox image download ${res.status}: ${imageUrl}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(destPath, buf)
}

// --- Webtoons (webtoons.com) — official manhwa/webtoons ---

const WEBTOONS_BASE = 'https://www.webtoons.com'

export async function fetchWebtoonsChapters(
  titleNo: number,
  chapterLimit: number,
): Promise<
  Array<{
    mangadexId: string
    chapterNum: string | null
    title: string | null
    language: string
    pageCount: number
    external: boolean
  }>
> {
  const res = await fetch(
    `${WEBTOONS_BASE}/en/fantasy/_/list?title_no=${titleNo}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    },
  )
  if (!res.ok) {
    throw new Error(`Webtoons chapters ${res.status} for title_no=${titleNo}`)
  }
  const html = await res.text()

  const chapters: Array<{
    mangadexId: string
    chapterNum: string | null
    title: string | null
    language: string
    pageCount: number
    external: boolean
  }> = []
  const seen = new Set<number>()
  const regex = /href="([^"]*\/viewer\?title_no=\d+&episode_no=(\d+))"/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    const epNo = parseInt(match[2], 10)
    if (seen.has(epNo)) continue
    seen.add(epNo)
    chapters.push({
      mangadexId: `ep-${epNo}`,
      chapterNum: String(epNo),
      title: null,
      language: 'en',
      pageCount: 0,
      external: false,
    })
  }
  chapters.reverse()
  return chapterLimit > 0 ? chapters.slice(0, chapterLimit) : chapters
}

export async function fetchWebtoonsChapterImages(
  titleNo: number,
  episodeNo: number,
): Promise<string[]> {
  // Find the viewer URL from the list page.
  const listRes = await fetch(
    `${WEBTOONS_BASE}/en/fantasy/_/list?title_no=${titleNo}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    },
  )
  if (!listRes.ok) {
    throw new Error(`Webtoons list ${listRes.status}`)
  }
  const listHtml = await listRes.text()

  const viewerRegex = new RegExp(
    `href="([^"]*episode_no=${episodeNo})"`,
    'i',
  )
  const viewerMatch = listHtml.match(viewerRegex)
  if (!viewerMatch) {
    throw new Error(`Episode ${episodeNo} not found for title_no=${titleNo}`)
  }
  const viewerUrl = viewerMatch[1].startsWith('http')
    ? viewerMatch[1]
    : `${WEBTOONS_BASE}${viewerMatch[1]}`

  const res = await fetch(viewerUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `${WEBTOONS_BASE}/`,
    },
  })
  if (!res.ok) {
    throw new Error(`Webtoons viewer ${res.status}`)
  }
  const html = await res.text()

  // Webtoons embeds image URLs in data-url attributes.
  const images: string[] = []
  const dataUrlRegex = /data-url="(https:\/\/webtoon-phinf\.pstatic\.net\/[^"]+)"/gi
  let m
  while ((m = dataUrlRegex.exec(html)) !== null) {
    images.push(m[1])
  }

  // Fallback: try src attributes.
  if (images.length === 0) {
    const srcRegex = /src="(https:\/\/webtoon-phinf\.pstatic\.net\/[^"]+)"/gi
    while ((m = srcRegex.exec(html)) !== null) {
      images.push(m[1])
    }
  }

  return images
}

export async function downloadWebtoonsImage(
  imageUrl: string,
  destPath: string,
): Promise<void> {
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: `${WEBTOONS_BASE}/`,
      Accept: 'image/*',
    },
  })
  if (!res.ok) {
    throw new Error(`Webtoons image download ${res.status}: ${imageUrl}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(destPath, buf)
}

// --- AsuraScans (asurascans.com) — JSON REST API ---
// AsuraScans is an Astro SPA with a clean REST API at api.asurascans.com.
//   GET /api/search?q={query}
//   GET /api/series/{slug}/chapters                       (newest-first)
//   GET /api/series/{slug}/chapters/{chapterSlug}         -> { chapter: { pages: [{url}] } }

const ASURA_API = 'https://api.asurascans.com'
const ASURA_WEB = 'https://asurascans.com'
const ASURA_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

interface AsuraChapter {
  id: number
  number: number
  title: string
  slug: string
}

interface AsuraChapterPage {
  url: string
}

/**
 * Fetch the chapter list for a manga from AsuraScans.
 * mangaId is the as-{slug} form; slug is the AsuraScans series slug.
 * Returns chapters oldest-first.
 */
export async function fetchAsuraScansChapters(
  mangaSlug: string,
  chapterLimit: number,
): Promise<
  Array<{
    mangadexId: string
    chapterNum: string | null
    title: string | null
    language: string
    pageCount: number
    external: boolean
  }>
> {
  const res = await fetch(
    `${ASURA_API}/api/series/${encodeURIComponent(mangaSlug)}/chapters`,
    {
      headers: {
        'User-Agent': ASURA_UA,
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    },
  )
  if (!res.ok) {
    throw new Error(`AsuraScans chapters ${res.status} for ${mangaSlug}`)
  }
  const body = await res.json()
  const chapters: AsuraChapter[] = body?.data ?? []

  // API returns newest-first; reverse to oldest-first.
  const oldest = [...chapters].reverse()
  const mapped = oldest.map((c) => ({
    mangadexId: c.slug, // chapter slug (UUID) — needed for the images endpoint
    chapterNum: String(c.number),
    title: c.title || null,
    language: 'en',
    pageCount: 0,
    external: false,
  }))
  return chapterLimit > 0 ? mapped.slice(0, chapterLimit) : mapped
}

/**
 * Fetch all page image URLs for an AsuraScans chapter via the JSON API.
 */
export async function fetchAsuraScansChapterImages(
  mangaSlug: string,
  chapterSlug: string,
): Promise<string[]> {
  const res = await fetch(
    `${ASURA_API}/api/series/${encodeURIComponent(mangaSlug)}/chapters/${encodeURIComponent(chapterSlug)}`,
    {
      headers: {
        'User-Agent': ASURA_UA,
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: `${ASURA_WEB}/`,
      },
    },
  )
  if (!res.ok) {
    throw new Error(`AsuraScans chapter ${res.status} for ${mangaSlug}/${chapterSlug}`)
  }
  const body = await res.json()
  const pages: AsuraChapterPage[] = body?.data?.chapter?.pages ?? []
  return pages.map((p) => p.url).filter((u): u is string => Boolean(u))
}

/** Download an AsuraScans image from cdn.asurascans.com. */
export async function downloadAsuraScansImage(
  imageUrl: string,
  destPath: string,
): Promise<void> {
  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': ASURA_UA,
      Referer: `${ASURA_WEB}/`,
      Accept: 'image/*',
    },
  })
  if (!res.ok) {
    throw new Error(`AsuraScans image download ${res.status}: ${imageUrl}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(destPath, buf)
}

// --- Unified dispatchers ---

export async function fetchChaptersForSource(
  source: ScraperSource,
  mangaId: string,
  chapterLimit: number,
) {
  const slug = getSlugFromId(mangaId)
  switch (source) {
    case 'mangahere':
      return fetchMangaHereChapters(slug, chapterLimit)
    case 'fanfox':
      return fetchFanFoxChapters(slug, chapterLimit)
    case 'webtoons':
      return fetchWebtoonsChapters(parseInt(slug, 10), chapterLimit)
    case 'asurascans':
      return fetchAsuraScansChapters(slug, chapterLimit)
  }
}

export async function fetchImagesForSource(
  source: ScraperSource,
  mangaId: string,
  chapterSlug: string,
): Promise<string[]> {
  const slug = getSlugFromId(mangaId)
  switch (source) {
    case 'mangahere':
      return fetchMangaHereChapterImages(slug, chapterSlug)
    case 'fanfox':
      return fetchFanFoxChapterImages(slug, chapterSlug)
    case 'webtoons':
      return fetchWebtoonsChapterImages(
        parseInt(slug, 10),
        parseInt(chapterSlug.replace(/^ep-/, ''), 10),
      )
    case 'asurascans':
      return fetchAsuraScansChapterImages(slug, chapterSlug)
  }
}

export async function downloadImageForSource(
  source: ScraperSource,
  imageUrl: string,
  destPath: string,
): Promise<void> {
  switch (source) {
    case 'mangahere':
      return downloadMangaHereImage(imageUrl, destPath)
    case 'fanfox':
      return downloadFanFoxImage(imageUrl, destPath)
    case 'webtoons':
      return downloadWebtoonsImage(imageUrl, destPath)
    case 'asurascans':
      return downloadAsuraScansImage(imageUrl, destPath)
  }
}

// ---------------------------------------------------------------------------
// VLM helper — generates per-chapter English summaries from scraped images.
// ---------------------------------------------------------------------------

let zaiPromise: Promise<unknown> | null = null

async function getZai() {
  // Lazy-load so the service can boot even if the SDK has issues at first run.
  if (!zaiPromise) {
    zaiPromise = (async () => {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      return await ZAI.create()
    })()
  }
  return await zaiPromise
}

/**
 * Generate an English narrative summary for a chapter by sampling up to 9
 * images (first 3, middle 3, last 3) and asking the VLM to describe them.
 *
 * Falls back to a minimal summary on any error so the pipeline never blocks.
 * NOTE: This is the OLD chapter-level summary. Prefer generateImageNarrations
 * for per-image narration that stays in sync with the video frames.
 */
export async function generateChapterSummary(
  imagePaths: string[],
): Promise<string> {
  if (imagePaths.length === 0) {
    return 'The chapter continues the story.'
  }

  // Pick up to 9 sample images: first 3, middle 3, last 3.
  const sample = pickSampleImages(imagePaths, 9)

  try {
    const zai = await getZai()

    // Build content array: text prompt + each sample image as a base64 data URL.
    const content: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    > = [
      {
        type: 'text',
        text:
          'You are summarizing a manhwa/manga chapter for a recap video. ' +
          'Look at these panel images (ordered from the beginning, middle, and end of the chapter) ' +
          'and write a detailed ENGLISH narrative summary of what happens: the events, ' +
          'character actions, key dialogue, and emotional beats. ' +
          'Write 3 to 6 sentences in third person, present tense, as if narrating a story. ' +
          'Do not mention chapter numbers. Do not mention that you are looking at images. ' +
          'Output only the summary text.',
      },
    ]

    for (const p of sample) {
      const buf = await fs.readFile(p)
      const b64 = buf.toString('base64')
      const mime = p.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${b64}` },
      })
    }

    const zaiAny = zai as {
      chat: {
        completions: {
          createVision: (opts: {
            messages: Array<{ role: string; content: typeof content }>
            thinking: { type: string }
          }) => Promise<{
            choices?: Array<{ message?: { content?: string } }>
          }>
        }
      }
    }

    const resp = await zaiAny.chat.completions.createVision({
      messages: [{ role: 'user', content }],
      thinking: { type: 'disabled' },
    })

    const text = resp?.choices?.[0]?.message?.content?.trim()
    if (text && text.length > 0) {
      return text
    }
    return 'The chapter continues the story.'
  } catch (err) {
    console.error('[VLM] summary generation failed:', err)
    return 'The chapter continues the story.'
  }
}

/**
 * Generate per-image narrations: send each image to the VLM individually and
 * get 2-4 sentences of narration describing exactly what's in that image.
 * This produces perfect sync — when the video shows image N, the narration
 * describes image N.
 *
 * Processes images with limited concurrency (3 at a time) to balance speed
 * and API load. Falls back to a generic sentence per image on any error so
 * the pipeline never blocks.
 *
 * Returns an array of { image, text } in the same order as imagePaths.
 */
export async function generateImageNarrations(
  imagePaths: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Array<{ image: string; text: string }>> {
  if (imagePaths.length === 0) {
    return []
  }

  const results: Array<{ image: string; text: string }> = new Array(imagePaths.length)
  // BATCHED processing: send BATCH_SIZE sliced panels per VLM call. The VLM
  // API accepts multiple images in a single message, so one call returns
  // transcriptions for all panels in the batch. This cuts API calls ~6x
  // (190 panels -> ~32 batch calls), dramatically reducing both total time
  // and rate-limit pressure.
  //
  // CONCURRENT processing: multiple batches run simultaneously to cut total
  // transcription time ~4-5x. Configurable via VLM_CONCURRENCY env var
  // (default 4). Each batch writes to disjoint indices in the results array
  // so there are no race conditions. If a batch call fails or returns
  // unparseable output, we fall back to single-image calls for just that
  // batch's panels (so no panel is permanently lost).
  const BATCH_SIZE = 6
  // Concurrency: 3 batches at a time = 18 panels transcribing in parallel.
  // Default 3 (not higher) because z-ai's free VLM tier rate-limits (429) when
  // too many calls overlap — especially when a batch fails and triggers 6
  // single-image fallback calls on top of the running batches. 3 is the sweet
  // spot: ~3x speedup with minimal 429 retries. Tune via VLM_CONCURRENCY env.
  const CONCURRENCY = Math.max(
    1,
    Math.min(6, parseInt(process.env.VLM_CONCURRENCY || '3', 10)),
  )

  // Build the list of batches to process.
  const batches: Array<{ images: string[]; startIdx: number; num: number }> = []
  for (let i = 0; i < imagePaths.length; i += BATCH_SIZE) {
    batches.push({
      images: imagePaths.slice(i, i + BATCH_SIZE),
      startIdx: i,
      num: Math.floor(i / BATCH_SIZE) + 1,
    })
  }
  const totalBatches = batches.length
  // Check Gemini BEFORE using it (const is block-scoped, not hoisted).
  const useGemini = isGeminiConfigured()
  const providers = useGemini ? 'z-ai + gemini (round-robin)' : 'z-ai'
  console.log(
    `[VLM] transcribing ${imagePaths.length} images in ${totalBatches} batches (${BATCH_SIZE}/batch) with concurrency ${CONCURRENCY} [${providers}]`,
  )

  // Atomic progress counter — shared across all concurrent workers.
  let completedPanels = 0
  const reportProgress = () => {
    if (onProgress) {
      onProgress(Math.min(completedPanels, imagePaths.length), imagePaths.length)
    }
  }

  // Round-robin counter — alternates batches between z-ai (even) and Gemini
  // (odd) so each provider handles ~half the load.
  let roundRobinCounter = 0

  // Circuit breaker: if Gemini returns N consecutive 429s, disable it for
  // the rest of this transcription. Avoids wasting time on retries when the
  // free-tier rate limit is exhausted. Resets on next job.
  let geminiConsecutive429s = 0
  let geminiDisabled = false
  const GEMINI_429_THRESHOLD = 3

  // Process a single batch — writes results into the shared array at the
  // batch's start index (disjoint from other batches, so no locking needed).
  async function processBatch(batch: (typeof batches)[0]): Promise<void> {
    const { images, startIdx, num } = batch

    // Pick provider: 1 in 3 batches goes to Gemini (1:2 ratio with z-ai).
    // Skipped if the circuit breaker has disabled Gemini (too many 429s).
    const useGeminiThisBatch = useGemini && !geminiDisabled && (roundRobinCounter++ % 3 === 2)
    const providerLabel = useGeminiThisBatch ? 'gemini' : 'z-ai'

    let batchTexts: string[]
    let succeeded = false
    let countedPerImage = false  // set true if single-image fallback counted panels
    try {
      if (useGeminiThisBatch) {
        batchTexts = await narrateImageBatchGemini(images, startIdx)
      } else {
        batchTexts = await narrateImageBatch(images, startIdx)
      }
      succeeded = true
    } catch (primaryErr) {
      const errMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr)
      const isContentFilter = errMsg.includes('contentFilter') || errMsg.includes('400')
      const isGemini429 = useGeminiThisBatch && errMsg.includes('429')

      // Circuit breaker: track consecutive Gemini 429s. After N, disable
      // Gemini for the rest of this transcription to stop wasting time.
      if (isGemini429) {
        geminiConsecutive429s++
        if (geminiConsecutive429s >= GEMINI_429_THRESHOLD && !geminiDisabled) {
          geminiDisabled = true
          console.warn(
            `[VLM:gemini] circuit breaker tripped after ${geminiConsecutive429s} consecutive 429s — disabling Gemini for this transcription`,
          )
        }
      } else if (useGeminiThisBatch && !isContentFilter) {
        // Gemini succeeded on a previous batch or failed non-429 — reset
        geminiConsecutive429s = 0
      }

      // Cross-provider fallback: if Gemini failed on a non-content-filter
      // error, retry the same batch on z-ai before giving up.
      if (useGeminiThisBatch && !isContentFilter) {
        try {
          console.warn(
            `[VLM:${providerLabel}] batch ${num}/${totalBatches} failed (${errMsg.slice(0, 80)}) — falling back to z-ai`,
          )
          batchTexts = await narrateImageBatch(images, startIdx)
          succeeded = true
        } catch {
          // Both providers failed — fall through to error handling below
        }
      }

      if (!succeeded) {
        // Content-filter: use placeholder text (single-image calls would
        // fail the same way and just trigger 429 rate limits).
        if (isContentFilter) {
          console.warn(
            `[VLM:${providerLabel}] batch ${num}/${totalBatches} hit content filter — using placeholder text for ${images.length} panels`,
          )
          batchTexts = images.map(() => 'The scene continues to unfold.')
          succeeded = true
        } else {
          // Non-content-filter error — fall back to single-image calls.
          console.warn(
            `[VLM:${providerLabel}] batch ${num}/${totalBatches} failed (${errMsg.slice(0, 80)}) — falling back to single-image calls`,
          )
          batchTexts = []
          countedPerImage = true
          for (const imgPath of images) {
            try {
              batchTexts.push(await narrateSingleImage(imgPath))
            } catch (e) {
              console.error(`[VLM:${providerLabel}] single-image fallback failed for ${path.basename(imgPath)}:`, e)
              batchTexts.push('The scene continues to unfold.')
            }
            completedPanels++
            reportProgress()
          }
          succeeded = true
        }
      }
    }

    // Write results for this batch.
    for (let j = 0; j < images.length; j++) {
      results[startIdx + j] = {
        image: path.basename(images[j]),
        text: batchTexts[j] ?? '',
      }
    }
    // Only increment once — the single-image fallback path already counted
    // per-image. The other paths (success, content-filter, cross-provider
    // fallback) count here.
    if (!countedPerImage) {
      completedPanels += images.length
    }
    reportProgress()
  }

  // Simple concurrency pool: spin up CONCURRENCY workers, each pulling the
  // next unprocessed batch from the queue. This naturally load-balances —
  // faster workers pick up more batches.
  let nextBatchIdx = 0
  async function worker(): Promise<void> {
    while (nextBatchIdx < batches.length) {
      const batchIdx = nextBatchIdx++
      await processBatch(batches[batchIdx])
    }
  }

  const workers: Promise<void>[] = []
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker())
  }
  await Promise.all(workers)

  return results
}

/**
 * Send a BATCH of sliced panels to the VLM in a single call and get back
 * per-panel transcriptions. The VLM API accepts multiple image_url content
 * blocks in one message, so we send up to BATCH_SIZE images and ask the model
 * to return a JSON array of {index, text} objects — one per panel, in order.
 *
 * This is the key optimization that makes sliced-panel transcription viable:
 * 190 panels -> ~32 batch calls instead of 190 single calls.
 *
 * Retries on rate-limit (429) and transient server errors (5xx) with
 * exponential backoff: 2s, 4s, 8s, 16s.
 */
async function narrateImageBatch(imgPaths: string[], batchStart: number): Promise<string[]> {
  // Check cache first — if all images in this batch are cached, skip the VLM call
  const cachedResults: (string | null)[] = []
  let allCached = true
  for (const imgPath of imgPaths) {
    const cached = await getVlmCached(vlmCacheKey(imgPath))
    cachedResults.push(cached)
    if (cached === null) allCached = false
  }
  if (allCached) {
    console.log(`[VLM] cache hit — all ${imgPaths.length} panels cached, skipping API call`)
    return cachedResults as string[]
  }

  const zai = await getZai()

  const images: Array<{ name: string; mime: string; b64: string }> = []
  for (const imgPath of imgPaths) {
    const buf = await fs.readFile(imgPath)
    const ext = path.extname(imgPath).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    images.push({ name: path.basename(imgPath), mime, b64: buf.toString('base64') })
  }

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [
    {
      type: 'text',
      text:
        `You are a precise transcriber for webtoon/manhwa panels, not a narrator. ` +
        `I am sending you ${images.length} separate panel images, labeled Panel 1 through Panel ${images.length} ` +
        `(in the order they appear below). For EACH panel, transcribe ONLY the actual text you can see inside ` +
        `speech bubbles, thought bubbles, and caption/narration boxes — in the order a reader would naturally ` +
        `read them (top to bottom, left to right within the panel). Translate to natural English if not already ` +
        `in English, preserving meaning and tone.\n\n` +
        `Guidelines:\n` +
        `1. Output the text VERBATIM (translated) — do not paraphrase, summarize, embellish, or add descriptive ` +
        `narration. Do not invent dialogue that is not actually written.\n` +
        `2. Do not describe artwork, action, or expressions — only transcribe written text that appears in the image.\n` +
        `3. If multiple bubbles/boxes are present in a panel, join them in reading order as separate sentences, ` +
        `preserving punctuation like "..." and "!" as written.\n` +
        `4. Sound effect text (e.g. "BOOM", "CRASH") can be included briefly if it is the only text present, ` +
        `otherwise skip pure onomatopoeia in favor of actual dialogue/captions.\n` +
        `5. If a panel has NO readable text at all (a purely visual/action panel with no bubbles or captions), ` +
        `use an empty string for that panel's text.\n\n` +
        `RESPONSE FORMAT: Return a JSON array with exactly ${images.length} elements, one per panel in order. ` +
        `Each element is an object: {"index": <1-based panel number>, "text": "<transcribed text or empty string>"}.\n` +
        `Output ONLY the JSON array — no preamble, no markdown fences, no explanation.\n` +
        `Example for 2 panels: [{"index": 1, "text": "What is this place?"}, {"index": 2, "text": ""}]`,
    },
    ...images.map(
      (img) =>
        ({
          type: 'image_url',
          image_url: { url: `data:${img.mime};base64,${img.b64}` },
        }) as { type: 'image_url'; image_url: { url: string } },
    ),
  ]

  const zaiAny = zai as {
    chat: {
      completions: {
        createVision: (opts: {
          messages: Array<{ role: string; content: typeof content }>
          thinking: { type: string }
        }) => Promise<{
          choices?: Array<{ message?: { content?: string } }>
        }>
      }
    }
  }

  const MAX_RETRIES = 4
  const BASE_DELAY_MS = 2000
  let lastErr: unknown = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await zaiAny.chat.completions.createVision({
        messages: [{ role: 'user', content }],
        thinking: { type: 'disabled' },
      })

      const raw = resp?.choices?.[0]?.message?.content?.trim() ?? ''
      const texts = parseBatchResponse(raw, images.length)
      // Cache each panel's transcription individually
      for (let i = 0; i < imgPaths.length && i < texts.length; i++) {
        if (texts[i]) {
          void setVlmCached(vlmCacheKey(imgPaths[i]), texts[i])
        }
      }
      return texts
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const isRetryable = /429|rate.?limit|too many requests|5\d{2}|server error|timeout|econnreset|socket hang up|fetch failed/i.test(msg)

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw err
      }

      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt)
      console.warn(
        `[VLM] batch (panels ${batchStart + 1}-${batchStart + images.length}) attempt ${attempt + 1}/${MAX_RETRIES + 1} failed (${msg.slice(0, 80)}) — retrying in ${delayMs}ms`,
      )
      await sleep(delayMs)
    }
  }

  throw lastErr
}

// ---------------------------------------------------------------------------
// GEMINI VLM — second provider for round-robin load balancing.
// Uses the Gemini 2.0 Flash REST API (free tier, vision-capable, fast).
// When configured, batches alternate between z-ai and Gemini to double
// throughput and halve the transcription time.
// ---------------------------------------------------------------------------

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

/**
 * Same interface as narrateImageBatch, but calls Google Gemini 2.0 Flash
 * via its REST API. Reuses the same prompt + cache + parseBatchResponse so
 * transcription quality is identical between providers.
 */
async function narrateImageBatchGemini(imgPaths: string[], batchStart: number): Promise<string[]> {
  // Check cache first (same cache as z-ai — a panel transcribed by either
  // provider is reused on re-runs).
  const cachedResults: (string | null)[] = []
  let allCached = true
  for (const imgPath of imgPaths) {
    const cached = await getVlmCached(vlmCacheKey(imgPath))
    cachedResults.push(cached)
    if (cached === null) allCached = false
  }
  if (allCached) {
    console.log(`[VLM:gemini] cache hit — all ${imgPaths.length} panels cached, skipping API call`)
    return cachedResults as string[]
  }

  const apiKey = process.env.GEMINI_API_KEY!
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  // Read + base64-encode each image.
  const images: Array<{ mime: string; b64: string }> = []
  for (const imgPath of imgPaths) {
    const buf = await fs.readFile(imgPath)
    const ext = path.extname(imgPath).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    images.push({ mime, b64: buf.toString('base64') })
  }

  // Same prompt as z-ai — keeps transcription consistent across providers.
  const prompt =
    `You are a precise transcriber for webtoon/manhwa panels, not a narrator. ` +
    `I am sending you ${images.length} separate panel images, labeled Panel 1 through Panel ${images.length} ` +
    `(in the order they appear below). For EACH panel, transcribe ONLY the actual text you can see inside ` +
    `speech bubbles, thought bubbles, and caption/narration boxes — in the order a reader would naturally ` +
    `read them (top to bottom, left to right within the panel). Translate to natural English if not already ` +
    `in English, preserving meaning and tone.\n\n` +
    `Guidelines:\n` +
    `1. Output the text VERBATIM (translated) — do not paraphrase, summarize, embellish, or add descriptive ` +
    `narration. Do not invent dialogue that is not actually written.\n` +
    `2. Do not describe artwork, action, or expressions — only transcribe written text that appears in the image.\n` +
    `3. If multiple bubbles/boxes are present in a panel, join them in reading order as separate sentences, ` +
    `preserving punctuation like "..." and "!" as written.\n` +
    `4. Sound effect text (e.g. "BOOM", "CRASH") can be included briefly if it is the only text present, ` +
    `otherwise skip pure onomatopoeia in favor of actual dialogue/captions.\n` +
    `5. If a panel has NO readable text at all (a purely visual/action panel with no bubbles or captions), ` +
    `use an empty string for that panel's text.\n\n` +
    `RESPONSE FORMAT: Return a JSON array with exactly ${images.length} elements, one per panel in order. ` +
    `Each element is an object: {"index": <1-based panel number>, "text": "<transcribed text or empty string>"}.\n` +
    `Output ONLY the JSON array — no preamble, no markdown fences, no explanation.\n` +
    `Example for 2 panels: [{"index": 1, "text": "What is this place?"}, {"index": 2, "text": ""}]`

  // Build Gemini request body.
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        ...images.map(img => ({ inline_data: { mime_type: img.mime, data: img.b64 } })),
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
    },
  }

  const MAX_RETRIES = 4
  const BASE_DELAY_MS = 2000
  let lastErr: unknown = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000) // 60s per batch
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 200)}`)
      }

      const data = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        error?: { message?: string }
      }

      if (data.error) {
        throw new Error(`Gemini error: ${data.error.message || JSON.stringify(data.error)}`)
      }

      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      const texts = parseBatchResponse(raw, images.length)

      // Cache each panel's transcription (same cache as z-ai).
      for (let i = 0; i < imgPaths.length && i < texts.length; i++) {
        if (texts[i]) {
          void setVlmCached(vlmCacheKey(imgPaths[i]), texts[i])
        }
      }
      return texts
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      // 429 = rate limited. Don't retry — the rate limit won't reset in 2-16s,
      // and the circuit breaker + z-ai fallback handle it. Throwing immediately
      // saves 30s of wasted retry backoff per batch.
      const is429 = msg.includes('429')
      if (is429) {
        throw err
      }
      const isRetryable = /5\d{2}|server error|timeout|econnreset|socket hang up|fetch failed|aborted/i.test(msg)

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw err
      }

      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt)
      console.warn(
        `[VLM:gemini] batch (panels ${batchStart + 1}-${batchStart + images.length}) attempt ${attempt + 1}/${MAX_RETRIES + 1} failed (${msg.slice(0, 80)}) — retrying in ${delayMs}ms`,
      )
      await sleep(delayMs)
    }
  }

  throw lastErr
}

/**
 * Parse the VLM's batch response into an array of per-panel text strings.
 *
 * The model is asked to return a JSON array like:
 *   [{"index": 1, "text": "..."}, {"index": 2, "text": ""}, ...]
 *
 * This function is defensive: it strips markdown code fences, extracts the
 * JSON array, and validates the element count. If parsing fails or the count
 * is wrong, it throws so the caller falls back to single-image calls.
 */
function parseBatchResponse(raw: string, expectedCount: number): string[] {
  if (!raw) {
    throw new Error('empty VLM batch response')
  }

  let cleaned = raw.trim()
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim()
  }

  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('no JSON array found in VLM batch response')
  }
  const jsonStr = cleaned.slice(start, end + 1)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch (e) {
    throw new Error(`failed to parse VLM batch JSON: ${e instanceof Error ? e.message : e}`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error('VLM batch response is not a JSON array')
  }

  const texts: string[] = new Array(expectedCount).fill('')
  for (let i = 0; i < parsed.length && i < expectedCount; i++) {
    const item = parsed[i]
    if (typeof item === 'object' && item !== null) {
      const obj = item as { index?: number; text?: string }
      const text = typeof obj.text === 'string' ? obj.text : ''
      const idx = typeof obj.index === 'number' ? obj.index - 1 : i
      if (idx >= 0 && idx < expectedCount) {
        texts[idx] = text
      } else {
        texts[i] = text
      }
    } else if (typeof item === 'string') {
      texts[i] = item
    }
  }

  return texts
}


/**
 * Send a single image to the VLM and get back the actual dialogue/caption
 * text from its speech bubbles, thought bubbles, and caption boxes —
 * transcribed as-is (translated to English), not narrated or paraphrased.
 *
 * Retries on rate-limit (429) and transient server errors (5xx) with
 * exponential backoff: 2s, 4s, 8s, 16s. This is critical because the pipeline
 * now makes one VLM call per sliced panel (190+ calls for a typical chapter),
 * so without backoff a single 429 would permanently lose that panel's text.
 */
async function narrateSingleImage(imgPath: string): Promise<string> {
  // Check cache first — if we've already transcribed this image, return instantly
  const cacheKey = vlmCacheKey(imgPath)
  const cached = await getVlmCached(cacheKey)
  if (cached !== null) {
    console.log(`[VLM] cache hit for ${path.basename(imgPath)}`)
    return cached
  }

  const zai = await getZai()

  const buf = await fs.readFile(imgPath)
  const b64 = buf.toString('base64')
  const ext = path.extname(imgPath).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [
    {
      type: 'text',
      text:
        'You are a precise transcriber for a webtoon/manhwa panel, not a narrator. ' +
        'Look at this single panel and transcribe ONLY the actual text you can see inside ' +
        'speech bubbles, thought bubbles, and caption/narration boxes — in the order a reader ' +
        'would naturally read them (top to bottom, left to right within the panel). ' +
        'Translate it into natural English if it is not already in English, preserving the ' +
        'original meaning and tone as closely as possible.\n\n' +
        'Guidelines:\n' +
        '1. Output the text VERBATIM (translated) — do not paraphrase, summarize, embellish, or ' +
        'add descriptive narration around it. Do not invent dialogue that is not actually written.\n' +
        '2. Do not describe the artwork, action, or characters\' expressions — only transcribe ' +
        'written text that literally appears in the image.\n' +
        '3. If multiple bubbles/boxes are present, join them in reading order as separate ' +
        'sentences, preserving punctuation like "..." and "!" as written.\n' +
        '4. Sound effect text (e.g. "BOOM", "CRASH") can be included briefly if it is the only ' +
        'text present, otherwise skip pure onomatopoeia in favor of actual dialogue/captions.\n' +
        '5. Never mention chapter numbers, page numbers, panels, or that you are looking at an image.\n' +
        '6. If the panel has NO readable text at all (a purely visual/action panel with no bubbles ' +
        'or captions), output nothing at all — an empty response. Do not invent narration to fill it.\n' +
        '7. Output ONLY the transcribed (translated) text — no preamble, no headers, no markdown, ' +
        'no notes about what you did.',
    },
    {
      type: 'image_url',
      image_url: { url: `data:${mime};base64,${b64}` },
    },
  ]

  const zaiAny = zai as {
    chat: {
      completions: {
        createVision: (opts: {
          messages: Array<{ role: string; content: typeof content }>
          thinking: { type: string }
        }) => Promise<{
          choices?: Array<{ message?: { content?: string } }>
        }>
      }
    }
  }

  // Exponential backoff for rate-limit (429) and transient server errors (5xx).
  // Base delays: 2s, 4s, 8s, 16s — caps total wait at ~30s before giving up.
  const MAX_RETRIES = 4
  const BASE_DELAY_MS = 2000
  let lastErr: unknown = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await zaiAny.chat.completions.createVision({
        messages: [{ role: 'user', content }],
        thinking: { type: 'disabled' },
      })

      const text = resp?.choices?.[0]?.message?.content?.trim()
      // Cache the result so re-runs skip this VLM call
      if (text) {
        void setVlmCached(cacheKey, text)
      }
      return text ?? ''
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      // Retry on 429 (rate limit) and 5xx (server errors). Don't retry on
      // 4xx client errors (bad request, auth, etc.) — those won't fix themselves.
      const isRetryable = /429|rate.?limit|too many requests|5\d{2}|server error|timeout|econnreset|socket hang up|fetch failed/i.test(msg)

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw err
      }

      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt)
      console.warn(
        `[VLM] ${path.basename(imgPath)} attempt ${attempt + 1}/${MAX_RETRIES + 1} failed (${msg.slice(0, 80)}) — retrying in ${delayMs}ms`,
      )
      await sleep(delayMs)
    }
  }

  throw lastErr
}

/**
 * Pick up to `maxCount` sample images from a sorted list: first N, middle N, last N.
 */
function pickSampleImages(paths: string[], maxCount: number): string[] {
  if (paths.length <= maxCount) return paths.slice()
  const n = Math.floor(maxCount / 3)
  const first = paths.slice(0, n)
  const midStart = Math.floor(paths.length / 2) - Math.floor(n / 2)
  const middle = paths.slice(midStart, midStart + n)
  const last = paths.slice(paths.length - n)
  // Dedupe in case of overlap on small arrays.
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of [...first, ...middle, ...last]) {
    if (!seen.has(p)) {
      seen.add(p)
      out.push(p)
    }
  }
  return out.slice(0, maxCount)
}
