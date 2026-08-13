# Manhwa Recap Studio v3 — Development Worklog

---
## Current Project Status Assessment

**Cycle**: Round 10 (Zhipu AI VLM integration)
**Date**: 2025-08-13 (America/Los_Angeles)
**Dev Server**: Next.js 16.1.3 (Turbopack) — ✅ running on port 3000
**Pipeline Service**: ✅ Bun Socket.IO on port 3001
**GitHub**: Pushed to `main` as commit `c0a826c`
**Lint**: Clean
**Database**: SQLite (Prisma ORM) — schema in sync, `zhipuKey` field added to Job model
**Agent Browser QA**: ✅ Zhipu key input verified on config page

### What Was Done This Session

1. **Zhipu AI VLM Provider Integration (lib.ts)**
   - Added `narrateImageBatchZhipu()` function (~120 lines)
   - Uses OpenAI-compatible API at `https://open.bigmodel.cn/api/paas/v4/chat/completions`
   - Model: `glm-4v-flash` (free, OCR-optimized, no rate limits)
   - Includes: cache integration, 3 retries with exponential backoff, 429-specific 15s base delay
   - Zhipu is now **#1 priority provider** in the fallback chain

2. **Provider Priority Update**
   - Order: `zhipu > groq > openrouter > gemini > ollama > z-ai`
   - Zhipu pre-flight test added (validates key via `/v4/models` endpoint)
   - Zhipu added to `HAS_API_KEYS` check
   - Zhipu dispatch in both `processBatch` and retry paths

3. **Gemini Model Fix**
   - Changed `gemini-2.0-flash-lite-001` → `gemini-2.5-flash` (old model decommissioned)

4. **Frontend Verification**
   - Confirmed Zhipu key input exists: `type=password`, `id=zhipuKey`
   - Label: "Zhipu AI (free — GLM-4V-Flash, optimized for OCR)"
   - Link: `open.bigmodel.cn (free signup)`
   - Settings persistence: loads/saves via `/api/settings`
   - Job submission: sends `zhipuKey` with POST `/api/jobs`

5. **Already Wired (from previous commit e1d0d4b)**
   - `prisma/schema.prisma`: `zhipuKey String?` on Job model
   - `src/types/pipeline.ts`: `zhipuKey` in `CreateJobInput` and `AppSettings`
   - `src/app/api/jobs/route.ts`: passes `zhipuKey` to DB on job creation
   - `src/app/api/settings/route.ts`: handles `zhipuKey` in settings CRUD
   - `src/components/pipeline/manga-config.tsx`: input field, state, submission
   - `src/components/pipeline/settings-dialog.tsx`: settings form field
   - `mini-services/pipeline-service/index.ts`: `['ZHIPU_API_KEY', job.zhipuKey, 'zhipuKey']` per-job key mapping
   - `mini-services/pipeline-service/prisma/schema.prisma`: `zhipuKey String?`

### User's Next Steps (on their server)
1. `cd ~/manhwa-recap-studio-v3 && git pull`
2. Get a free Zhipu AI API key from https://open.bigmodel.cn
3. Enter the key in the frontend config OR set `ZHIPU_API_KEY` in the systemd service
4. The pipeline service will auto-detect and use Zhipu as the primary VLM provider

### Unresolved / Risks
- **Gemini model**: `gemini-2.5-flash` may still not work as a vision model — needs real API test
- **Pipeline service Prisma push**: `npx` not available on the user's server (they don't have npm). The pipeline service uses a separate Prisma instance but the schema was already pushed from the main project
- **Exposed GitHub PAT**: was shared in chat — should be revoked immediately

### Provider Status Summary
| Provider | Status | Notes |
|----------|--------|-------|
| Zhipu AI (GLM-4V-Flash) | ✅ Integrated | Free, no rate limits, OCR-optimized, #1 priority |
| Groq (qwen3.6-27b) | ⚠️ Limited | 8000 TPM on free tier — too low for images |
| OpenRouter (nemotron-nano) | ✅ Working | Slow (10-30s/batch), occasional timeouts |
| Gemini (2.5-flash) | ❓ Unconfirmed | Model may not support vision |
| Ollama (llava:7b) | ❌ Too slow | ~82s/panel on CPU |
| z-ai SDK | ❌ Sandbox only | Only works in Z.ai environment |
