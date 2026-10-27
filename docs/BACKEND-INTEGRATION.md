# Backend integration (Phase 7)

How the DocuA4 frontend talks to the live Cloud Run backend
(`https://systembackendservice-506195874849.us-central1.run.app`, API base
includes the `/api/v1` prefix). Fixture mode (`VITE_DATA_SOURCE=fixtures`)
remains fully offline: no Firebase initialization, no network calls.

## Auth flow: login → sync-user → session ready

1. **Sign-in** — `signIn(email, password)` calls Firebase Authentication
   (email/password). The Firebase SDK owns token storage and refresh; the
   frontend never persists ID tokens itself.
2. **Handshake (once per session)** — immediately after sign-in (or after
   Firebase restores a persisted session at startup) the frontend calls
   `POST /api/v1/auth/sync-user` with
   `{ displayName: user.displayName ?? email-prefix }`
   (`src/lib/api/sync-user.ts`). The backend creates/updates its PostgreSQL
   user record and returns the app profile, which is cached for the session
   and stored in the session context.
   - `401` from the handshake → sign out everywhere.
   - Network failure → one retry with backoff, then the session surfaces the
     error (the user can retry by signing in again).
   - The handshake also re-runs automatically when any API call returns
     `401 USER_NOT_SYNCED` (see error table).
3. **Session ready** — authenticated calls attach
   `Authorization: Bearer <ID token>`.

## Token refresh behavior

- Every request fetches a fresh token through `auth.currentUser.getIdToken()`
  (Firebase caches internally and only refreshes when the cached token is
  near expiry, so this is cheap).
- On `401`: one forced refresh (`getIdToken(true)`) + a single retry. If the
  retry also returns 401, the client signs the user out (Firebase sign-out +
  `POST /auth/logout` acknowledgement) and shows a "session expired" toast;
  the route guard redirects to `/login`.

## Error codes → frontend behavior

All backend errors use the envelope `{ error: { code, message, ...extras } }`
(extras such as `currentVersion`, `dailyQuotaLimit`, `field` ride along).

| HTTP | Code | Frontend behavior |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | Forced token refresh + one retry; second 401 → sign out + "session expired" toast + redirect to `/login`. |
| 401 | `USER_NOT_SYNCED` | Runs the sync-user handshake, refreshes the token, retries once. |
| 404 | `NOT_FOUND` | Tenancy isolation: repositories map to `null` where the interface allows it, otherwise the page's existing 404/error state renders. |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Bug guard — every create call sends a key; surfaces as a regular API error. |
| 422 | `UNPROCESSABLE_ENTITY` | Idempotency key reused with a different payload — surfaced as the save error state. |
| 428 | `PRECONDITION_REQUIRED` | PATCH without `If-Match` — the editor always sends the last-seen version; surfaces as save error. |
| 409 | `VERSION_CONFLICT` | `VersionConflictError{currentVersion}` → editor conflict UI offering reload-latest or overwrite. |
| 429 | `TOO_MANY_REQUESTS` / `QUOTA_EXCEEDED` | `RateLimitError{retryAfterSeconds}` (from `Retry-After`) → friendly throttle message, cooldown indicator. |
| 400 | `MISSING_REQUIRED_FIELD` | Wizard highlights the missing field (`error.field`). |
| 0 | — (network) | `ApiError(0)` → existing retry/error states; the sync-user handshake retries once with backoff. |

## Write-safety headers

- `POST /api/v1/documents` and `POST /api/v1/ai/generate` send
  `Idempotency-Key: <UUID>` (`src/lib/api/idempotency.ts`), one key per user
  action, reused across retries of that action.
- `PATCH /api/v1/documents/:id` and `…/title` send `If-Match: <version>` from
  the editor's last-seen `version`.
- The implicit document creation after a completed guided-flow generation uses
  the deterministic key `generation-doc-<jobId>` so poll races and replays can
  never create duplicates.

## Backend gaps

### (a) Endpoints the frontend already needs (graceful degradation today)

| Surface | Missing endpoints | Frontend behavior until they ship |
| --- | --- | --- |
| Preferences | `GET/PATCH /preferences`, `POST /preferences/sync` | **Local-first**: localStorage persistence keeps working; remote sync skipped silently (dev-only `console.info`); no user-facing errors. |
| Favorites | `GET /favorites/templates`, `POST/DELETE /favorites/templates/:id` | **Local-first**: stars work via localStorage; remote sync skipped silently; toggling never throws. |
| Notifications | `GET /notifications`, `POST /notifications/read-all` | Real errors surface in the notifications menu's existing error state (never fabricated). |
| Exports | — (shipped: `POST /exports` + short-lived download link) | "Download PDF" saves first, then downloads under the document title. Older backends without it: honest failure + browser print-to-PDF fallback. Designs are refused by the backend (422) and print from the browser. |
| Usage counter | `GET /usage` (documentsThisMonth) | Usage widget shows "unavailable"; real AI usage is available via `GET /ai/usage` on the generation repository. |

### (b) Endpoints needing additive backend work (frontend works around them)

- **Template query parameters** — the backend supports only `locale`;
  category/search/language/sort/pagination are applied client-side after
  fetching the full list. Server-side filtering should land before the
  catalogue grows.
- **Relevance sorting** — fixture mode scores relevance heuristically; API
  mode degrades `sortBy=relevance` to the backend's popularity ordering.
- **Generation result → document** — shipped: the backend creates the
  document with the job and returns its `documentId`; the frontend only
  creates it itself for older backends (deterministic idempotency key).

### (c) Shipped since

- **Organizations** — `GET/POST/PATCH /organization`, signatories and
  members (docs/API.md §6 in the backend).
- **Designs** — documents have `kind` (`text` | `design`). Designs open in
  the design editor (`src/designs/`, loaded only for designs), never in the
  text editor. `GET /features` (`{ designs }`, from the backend's
  `FEATURE_DESIGNS` setting) decides whether the Designs shelf and the
  dialog's Designs group show; an older backend or an error means off.
  Demo mode always shows designs.
- **Logos and photos** — `POST/GET/DELETE /media` (backend docs/API.md §9)
  and `logoMediaId` on the organization. Images are shrunk in the browser
  first (`src/lib/media/prepare.ts`: logos PNG ≤ 1000 px, photos JPEG
  ≤ 1200 px) and shown as blob URLs because `GET /media/:id` needs auth.
  Design content stores `images: { slot: mediaId }`; new designs start with
  the organization logo. Demo mode keeps images in this browser only.
- **Shared documents** — `PUT /documents/:id/sharing` and
  `GET /documents?scope=shared` (backend docs/API.md §4). My Documents gets
  "My documents / Shared with my organization" tabs and a share button per
  own document. A colleague's document (`access: "view"`) opens read only —
  text in `SharedDocumentView` (the editor's A4 pages, not editable), designs
  in the design editor without its form — with Print and "Make my own
  copy". An older backend (no `shared` flag) shows nothing as shared.
- **Batch certificates** — design content may carry `batch.rows` (≤ 300,
  one printed page per row; each row replaces the recipient names and
  number). The list is read in the browser (`src/designs/batch.ts`: pasted
  from Excel, typed, or a CSV file) and printed by the browser; all pages
  are rendered only while printing, so editing stays fast.

## Contract mapping notes

- `GenerationRequestInput.documentType` (frontend) ↔ `templateId` (backend)
  — mapped in the HTTP generation repository.
- Document `content` is a JSON string in the editor and in backend responses,
  but an object in request bodies — parsed at the endpoint layer.
- `GET /documents` returns a bare array (+ `X-Total-Count` header); the
  repository maps it to the frontend's `DocumentRecord[]` shape including
  `version` and nullable `templateId`/`templateTitle` for blank documents.
- `sync-user` profile `{ displayName }` maps to `SessionUser.name` with the
  email prefix as fallback; roles are display-only (backend enforces).

## Phase 8 optimization target

Firebase is statically imported, so the SDK ships in fixture-mode bundles too.
Lazy-loading Firebase (dynamic import in the API-mode repository path) is the
flagged Phase 8 bundle-size optimization.
