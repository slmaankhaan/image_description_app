# Image Description App

## Context
2-3 hour take-home. Graded on scoping judgment and clarity of decisions, NOT
completeness. A reviewer clones this, adds their own API key, runs it. Optimize
for that path being frictionless and the code being obvious on first read.

## Stack — pinned, do not substitute
- Fastify 5 (v5 patterns only: async handlers, `setErrorHandler`. NOT v3/v4 idioms)
- better-sqlite3, raw prepared statements. NO ORM, NO query builder
- Vite + React 19 + TypeScript strict. No UI library, no Tailwind — one CSS file
- @anthropic-ai/sdk, model `claude-haiku-4-5-20251001`
- Vitest. tsx as the dev runner — no server build step in dev

## Comments
Explain WHY, never WHAT. No comment should restate what the code already says.
Write one where a reader would reasonably ask "why is it done this way?" —
non-obvious constraints, deliberate omissions, decisions with a tradeoff behind
them. A short JSDoc block on each exported module's purpose is fine. Everything
else stays uncommented; the naming should carry it.

## Hard rules
- Ask before adding ANY dependency not listed above
- No SQL outside `server/src/db/images.ts`
- No `reply.status()` in route handlers — throw AppError subclasses
- Vision API reached only through the `VisionClient` interface
- GET and POST only. No PUT, PATCH, or DELETE
- Never write a real API key into any file. `.env` is gitignored from commit one
- Do NOT build: auth, Docker, pagination, rate limiting, retries/backoff,
  cloud storage, migration tooling, a logger wrapper, React component tests
- Never create, modify, or delete `.env` — it holds a real API key and is the
  user's file to manage, not code to generate or touch

## Structure
```
server/src/
  index.ts          # boot: config, db, listen
  app.ts            # buildApp(deps) -> FastifyInstance (no listen — testable)
  config.ts         # env parsing, fail fast on missing key
  errors.ts         # AppError + subclasses
  error-handler.ts  # setErrorHandler + setNotFoundHandler
  db/schema.sql
  db/index.ts       # open, exec schema
  db/images.ts      # repository
  routes/images.ts
  vision/types.ts   # VisionClient interface
  vision/fake-client.ts
  vision/anthropic-client.ts
  vision/index.ts   # factory: real vs fake
server/tests/
web/src/
  App.tsx  api.ts  styles.css
  components/UploadForm.tsx  components/ImageList.tsx
```

## Schema
```sql
CREATE TABLE IF NOT EXISTS images (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL CHECK (status IN ('pending','ready','failed')),
  error_message TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
```

## Key decision: async description
Do NOT block the upload response on the vision call.
1. Stream to `data/uploads/<uuid>.<ext>`, enforce 10MB cap while streaming
2. Validate MIME type AND magic bytes (JPEG/PNG/GIF/WebP)
3. Insert row `status='pending'`, return 201 immediately
4. Fire-and-forget: read file → base64 → `describe()` → `markReady`/`markFailed`.
   Errors caught and logged, never crash the process
5. Frontend polls `GET /api/images` every 2s while any row is pending; stops when none
## API
| Method | Path | Success |
|---|---|---|
| POST | /api/images | 201 — multipart, field `file` |
| GET | /api/images | 200 — `{ images: [] }` newest first |
| GET | /api/images/:id | 200, 404 if unknown |
| GET | /api/images/:id/file | 200 — streams bytes |
| GET | /health | 200 |

Errors always: `{ error: { code, message, details? } }`
400 no file / bad multipart · 404 unknown id · 413 over 10MB ·
415 disallowed MIME · 422 magic bytes disagree · 500 unexpected.
Never leak internal error text on 500.

## Vision
```ts
export interface VisionClient {
  describe(input: { imageBase64: string; mimeType: string }): Promise<string>;
}
```
Prompt: "Describe this image in 2-3 sentences. Cover the main subject, the
setting, and any notable details. Respond with plain prose only — no markdown,
no headings, no bullet points, no preamble."
`max_tokens: 300`. Wrap SDK failures in `VisionServiceError`.
`createFakeVisionClient({ description?, shouldFail?, delayMs? })` for tests.

`vision/index.ts` factory: if `USE_FAKE_VISION=true`, return the fake client and
skip the API key check entirely. Otherwise require `ANTHROPIC_API_KEY` and return
the real client. Tests construct the fake directly, not via the env var.

## Tests
Repository round-trip and `markFailed`, plus route coverage for no file → 400,
text/plain → 415, and valid PNG with fake client → 201 pending → ready.
Use `buildApp()` + `app.inject()`. No HTTP server, no real API calls in tests.

## Frontend
Single page: file input + button, upload error state, list of cards with
thumbnail, filename, and either the description, "Generating description…",
or the failure message. Disable button during upload. Surface server
`error.message`. Plain and uncluttered — not a design exercise, but not broken.
