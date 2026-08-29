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
setting, and any notable details. Write plain prose with no preamble."
`max_tokens: 300`. Wrap SDK failures in `VisionServiceError`.
`createFakeVisionClient({ description?, shouldFail?, delayMs? })` for tests.

`vision/index.ts` factory: if `USE_FAKE_VISION=true`, return the fake client and
skip the API key check entirely. Otherwise require `ANTHROPIC_API_KEY` and return
the real client. Tests construct the fake directly, not via the env var.

## Tests — exactly these five
1. repository round-trip, pending → ready
2. `markFailed` sets status and error_message
3. POST no file → 400
4. POST text/plain → 415
5. POST valid PNG with fake client → 201 pending; after async settles, GET → ready
   Use `buildApp()` + `app.inject()`. No HTTP server, no real API calls in tests.

## Frontend
Single page: file input + button, upload error state, list of cards with
thumbnail, filename, and either the description, "Generating description…",
or the failure message. Disable button during upload. Surface server
`error.message`. Plain and uncluttered — not a design exercise, but not broken.

## Also produce
- `.gitignore` (ignore `.env`, `data/`, `node_modules/`, `dist/`) and
  `.env.example` — FIRST, before any code
- `.env.example` lists `ANTHROPIC_API_KEY`, `PORT`, `DATABASE_PATH`,
  `UPLOAD_DIR`, `MAX_FILE_SIZE_BYTES`, and a commented-out `USE_FAKE_VISION=true`
  with a one-line note that it runs the app without a key
- Root `package.json` with `npm run dev` running server + web concurrently,
  plus `npm test` and `npm run typecheck`
- Vite proxy `/api` → `http://localhost:3000`
- Boot exits with a clear message naming `.env.example` if the key is missing,
  and mentioning `USE_FAKE_VISION=true` as the key-free alternative
- README setup section covering both paths: with a key, and `USE_FAKE_VISION=true`

## Working method
After EACH phase: run `npx tsc --noEmit && npx vitest run`, fix what breaks,
give me a 3-line summary, then STOP for review. I commit each phase myself once
I've reviewed it — do not run git commands.

Phase 1 — .gitignore, .env.example, scaffold, config, schema, db/index,
repository, and the two repository tests (round-trip, markFailed)

Phase 2 — errors, error-handler, vision (types, fake, anthropic, factory)

Phase 3 — routes, app.ts, index.ts, and the three route tests
(no file → 400, text/plain → 415, valid PNG → 201 then ready)

Phase 4 — frontend

Phase 5 — README, then trim this file: delete the Working method section and
the phase list, leaving only the project constraints

Keep a running list of every place you chose between two reasonable approaches —
I want those for the tradeoffs section.
 