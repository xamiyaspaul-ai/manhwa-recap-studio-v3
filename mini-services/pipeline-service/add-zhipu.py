#!/usr/bin/env python3
"""Add Zhipu AI (GLM-4V-Flash) as a VLM provider to pipeline-service/lib.ts and index.ts.
Run this on the Oracle Cloud server:
  cd ~/manhwa-recap-studio-v3
  python3 mini-services/pipeline-service/add-zhipu.py
"""

import re, sys

LIB = 'mini-services/pipeline-service/lib.ts'
INDEX = 'mini-services/pipeline-service/index.ts'

def read(path):
    with open(path, 'r') as f:
        return f.read()

def write(path, content):
    with open(path, 'w') as f:
        f.write(content)
    print(f"  ✓ Updated {path}")

def apply(text, label, old, new):
    if old in text:
        text = text.replace(old, new, 1)
        print(f"  ✓ {label}")
    else:
        print(f"  ✗ {label} — pattern not found (may already be applied)")
    return text

def insert_before(text, label, marker, new_code):
    if marker in text and 'zhipu' not in text.split(marker)[0][-200:]:
        text = text.replace(marker, new_code + '\n' + marker, 1)
        print(f"  ✓ {label}")
    else:
        print(f"  ✗ {label} — marker not found or already applied")
    return text

def insert_after(text, label, marker, new_code):
    if marker in text and 'zhipu' not in text.split(marker)[1][:200]:
        idx = text.index(marker) + len(marker)
        text = text[:idx] + '\n' + new_code + text[idx:]
        print(f"  ✓ {label}")
    else:
        print(f"  ✗ {label} — marker not found or already applied")
    return text

# ─── lib.ts changes ───────────────────────────────────────────────────────────
print("=== Patching lib.ts ===")
lib = read(LIB)

# 1. Add 'zhipu' to VlmProvider type
lib = apply(lib, 'VlmProvider type',
    "type VlmProvider = 'groq' | 'gemini' | 'openrouter' | 'ollama' | 'z-ai'",
    "type VlmProvider = 'zhipu' | 'groq' | 'gemini' | 'openrouter' | 'ollama' | 'z-ai'"
)

# 2. Add Zhipu pre-flight test (insert before the openrouter test)
zhipu_preflight = """      if (provider === 'zhipu' && process.env.ZHIPU_API_KEY) {
        // Quick validation: send a tiny chat request to GLM-4V-Flash.
        const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.ZHIPU_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'glm-4v-flash',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 5,
          }),
          signal: AbortSignal.timeout(15000),
        })
        if (res.ok) { console.log('[VLM] ✓ Zhipu key is valid'); return true }
        console.warn(`[VLM] ✗ Zhipu key invalid (HTTP ${res.status})`)
        return false
      }"""

lib = insert_before(lib, 'Zhipu pre-flight test',
    "      if (provider === 'openrouter'", zhipu_preflight)

# 3. Add zhipu to the parallel test array
lib = apply(lib, 'Test array',
    "testProvider('openrouter'),\n  ])\n  if (tests[0]) activeProviders.push('ollama')\n  if (tests[1]) activeProviders.push('groq')\n  if (tests[2]) activeProviders.push('gemini')\n  if (tests[3]) activeProviders.push('openrouter')",
    "testProvider('zhipu'),\n    testProvider('openrouter'),\n  ])\n  if (tests[0]) activeProviders.push('ollama')\n  if (tests[1]) activeProviders.push('groq')\n  if (tests[2]) activeProviders.push('gemini')\n  if (tests[3]) activeProviders.push('zhipu')\n  if (tests[4]) activeProviders.push('openrouter')"
)

# 4. Add ZHIPU_API_KEY to HAS_API_KEYS check
lib = apply(lib, 'HAS_API_KEYS check',
    "const HAS_API_KEYS = !!(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)",
    "const HAS_API_KEYS = !!(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.ZHIPU_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY)"
)

# 5. Add zhipu to providerOrder (first priority — free, fast, optimized for text extraction)
lib = apply(lib, 'Provider order',
    "const providerOrder: VlmProvider[] = ['groq', 'openrouter', 'gemini', 'ollama', 'z-ai']",
    "const providerOrder: VlmProvider[] = ['zhipu', 'gemini', 'openrouter', 'groq', 'ollama', 'z-ai']"
)
# Also try the version without groq (in case user's sed already removed it)
lib = apply(lib, 'Provider order (no groq)',
    "const providerOrder: VlmProvider[] = ['gemini', 'openrouter', 'ollama', 'z-ai']",
    "const providerOrder: VlmProvider[] = ['zhipu', 'gemini', 'openrouter', 'ollama', 'z-ai']"
)

# 6. Add zhipu dispatch in processBatch (primary call)
lib = apply(lib, 'processBatch dispatch',
    "      } else if (providerLabel === 'openrouter') {\n        batchTexts = await narrateImageBatchOpenRouter(images, startIdx)\n      } else {",
    "      } else if (providerLabel === 'zhipu') {\n        batchTexts = await narrateImageBatchZhipu(images, startIdx)\n      } else if (providerLabel === 'openrouter') {\n        batchTexts = await narrateImageBatchOpenRouter(images, startIdx)\n      } else {"
)

# 7. Add zhipu dispatch in retry section
lib = apply(lib, 'Retry dispatch',
    "            if (retryProvider === 'groq') batchTexts = await narrateImageBatchGroq(images, startIdx)\n            else if (retryProvider === 'gemini') batchTexts = await narrateImageBatchGemini(images, startIdx)\n            else if (retryProvider === 'openrouter') batchTexts = await narrateImageBatchOpenRouter(images, startIdx)\n            else if (retryProvider === 'ollama') batchTexts = await narrateImageBatchOllama(images, startIdx)",
    "            if (retryProvider === 'zhipu') batchTexts = await narrateImageBatchZhipu(images, startIdx)\n            else if (retryProvider === 'groq') batchTexts = await narrateImageBatchGroq(images, startIdx)\n            else if (retryProvider === 'gemini') batchTexts = await narrateImageBatchGemini(images, startIdx)\n            else if (retryProvider === 'openrouter') batchTexts = await narrateImageBatchOpenRouter(images, startIdx)\n            else if (retryProvider === 'ollama') batchTexts = await narrateImageBatchOllama(images, startIdx)"
)

# 8. Add the narrateImageBatchZhipu function (insert before the OpenRouter section)
zhipu_function = '''
// ---------------------------------------------------------------------------
// ZHIPU AI (GLM-4V-Flash) — fifth provider (free, fast, optimized for OCR/text extraction)
// Zhipu AI offers GLM-4V-Flash as a free-to-use vision model with no rate
// limits for normal usage. Uses OpenAI-compatible API format.
// Sign up at https://open.bigmodel.cn to get a free API key.
// ---------------------------------------------------------------------------

async function narrateImageBatchZhipu(imgPaths: string[], batchStart: number): Promise<string[]> {
  // Check cache first (same cache as other providers).
  const cachedResults: (string | null)[] = []
  let allCached = true
  for (const imgPath of imgPaths) {
    const cached = await getVlmCached(vlmCacheKey(imgPath))
    cachedResults.push(cached)
    if (cached === null) allCached = false
  }
  if (allCached) {
    console.log(`[VLM:zhipu] cache hit — all ${imgPaths.length} panels cached, skipping API call`)
    return cachedResults as string[]
  }

  const apiKey = process.env.ZHIPU_API_KEY!
  const model = process.env.ZHIPU_VLM_MODEL || 'glm-4v-flash'
  const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

  // Read + base64-encode each image.
  const images: Array<{ mime: string; b64: string }> = []
  for (const imgPath of imgPaths) {
    const buf = await fs.readFile(imgPath)
    const ext = path.extname(imgPath).toLowerCase()
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
    images.push({ mime, b64: buf.toString('base64') })
  }

  // Same prompt as other providers.
  const prompt =
    `You are a precise transcriber for webtoon/manhwa panels, not a narrator. ` +
    `I am sending you ${images.length} separate panel images, labeled Panel 1 through Panel ${images.length} ` +
    `(in the order they appear below). For EACH panel, transcribe ONLY the actual text you can see inside ` +
    `speech bubbles, thought bubbles, and caption/narration boxes — in the order a reader would naturally ` +
    `read them (top to bottom, left to right within the panel). Translate to natural English if not already ` +
    `in English, preserving meaning and tone.\n\n` +
    `RESPONSE FORMAT: Return a JSON array with exactly ${images.length} elements, one per panel in order. ` +
    `Each element is an object: {"index": <1-based panel number>, "text": "<transcribed text or empty string>"}.\n` +
    `Output ONLY the JSON array — no preamble, no markdown fences, no explanation.\n` +
    `Example for 2 panels: [{"index": 1, "text": "What is this place?"}, {"index": 2, "text": ""}]`

  const content = [
    { type: 'text', text: prompt },
    ...images.map(img => ({
      type: 'image_url',
      image_url: { url: `data:${img.mime};base64,${img.b64}` },
    })),
  ]

  const body = {
    model,
    messages: [{ role: 'user', content }],
    temperature: 0.1,
    max_tokens: 4096,
  }

  const MAX_RETRIES = 3
  const BASE_DELAY_MS = 2000
  let lastErr: unknown = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Zhipu API ${res.status}: ${errText.slice(0, 200)}`)
      }

      const data = await res.json() as {
        choices?: Array<{ message?: { content?: string } }>
        error?: { message?: string }
      }

      if (data.error) {
        throw new Error(`Zhipu error: ${data.error.message || JSON.stringify(data.error)}`)
      }

      const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
      const texts = parseBatchResponse(raw, images.length)

      // Cache each panel's transcription.
      for (let i = 0; i < imgPaths.length && i < texts.length; i++) {
        if (texts[i]) {
          await setVlmCached(vlmCacheKey(imgPaths[i]), texts[i])
        }
      }
      return texts
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('403')) throw err
      if (msg.includes('429')) {
        if (attempt === MAX_RETRIES) throw err
        const delayMs = 15000 * Math.pow(2, attempt)
        console.warn(`[VLM:zhipu] rate limited — retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES + 1})`)
        await sleep(delayMs)
        continue
      }
      const isRetryable = /5\d{2}|server error|timeout|econnreset|socket hang up|fetch failed|aborted/i.test(msg)
      if (!isRetryable || attempt === MAX_RETRIES) throw err
      const delayMs = BASE_DELAY_MS * Math.pow(2, attempt)
      console.warn(`[VLM:zhipu] batch retry ${attempt + 1}/${MAX_RETRIES + 1} failed (${msg.slice(0, 80)}) — retrying in ${delayMs}ms`)
      await sleep(delayMs)
    }
  }

  throw lastErr
}
'''

lib = insert_before(lib, 'Zhipu function',
    '// ---------------------------------------------------------------------------\n// OPENROUTER VLM', zhipu_function)

write(LIB, lib)

# ─── index.ts changes ─────────────────────────────────────────────────────────
print("\n=== Patching index.ts ===")
idx = read(INDEX)

# Add ZHIPU_API_KEY to per-job key mapping
idx = apply(idx, 'Per-job ZHIPU key',
    "    ['OPENROUTER_API_KEY', job.openRouterKey, 'openRouterKey'],\n    ['OPENAI_API_KEY', job.openaiKey, 'openaiKey'],",
    "    ['OPENROUTER_API_KEY', job.openRouterKey, 'openRouterKey'],\n    ['ZHIPU_API_KEY', job.zhipuKey, 'zhipuKey'],\n    ['OPENAI_API_KEY', job.openaiKey, 'openaiKey'],"
)

write(INDEX, idx)

print("\n=== Done! ===")
print("Next steps:")
print("1. Get a free API key from https://open.bigmodel.cn")
print("2. Set ZHIPU_API_KEY in your systemd service or .env:")
print("   sudo sed -i '/^\[Service\]/a Environment=ZHIPU_API_KEY=your-key-here' /etc/systemd/system/pipeline-service.service")
print("3. sudo systemctl daemon-reload && sudo systemctl restart pipeline-service")
