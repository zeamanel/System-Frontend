# DocuA4 Frontend — Architecture

Phase 1 foundation for the DocuA4 document workspace. This document records
the current state, the decisions behind it, and the conventions to follow as
features land.

## Stack

| Concern | Choice | Rationale |
| --- | --- | --- |
| UI framework | React 18 + TypeScript (strict) | Component model fits a workspace UI; huge ecosystem. |
| Build tooling | Vite 5 | Fast dev loop; produces a static bundle deployable anywhere. |
| Routing | React Router v6 (`BrowserRouter`, lazy routes) | De-facto standard; nested shell layout via `Outlet`. |
| Server state | TanStack Query v5 | Caching, retries, loading/error states without ad-hoc effects. |
| Styling | Plain CSS + semantic design tokens | Zero styling deps; entire theme restylable from `tokens.css`. |
| API access | Native `fetch` behind a typed client | No axios; single boundary for headers, errors, base URL. |
| i18n | Dependency-free typed provider (en/am) | Keys derived from `en.json`; Amharic completeness compile-checked. |
| Tests | Vitest + Testing Library (jsdom) | Matches Vite; user-centric component testing. |

No state-management library beyond TanStack Query + React context — on
purpose. Revisit only when client state genuinely outgrows context.

## Directory map

```
src/
  main.tsx              # entry: global styles + <App />
  App.tsx               # provider composition (Query → I18n → Prefs → Session → Toast → Router)
  routes.tsx            # central route table, lazy pages, session guard
  config/env.ts         # typed, validated VITE_* environment access
  styles/
    tokens.css          # ALL design tokens (semantic, monochrome)
    base.css            # reset + element defaults + a11y utilities
  i18n/                 # locales, typed resources, provider, hook
  preferences/          # regional preferences (country), provider, hook
  session/              # SessionProvider, RequireSession guard, useSession
  lib/
    api/                # API-client boundary (client, auth store, endpoints)
    editor/             # structured document model, sanitizer, paginator, font strategy
    repositories/       # replaceable data layer: interfaces, fixtures, HTTP impls
    query-client.ts     # TanStack Query defaults
    query-keys.ts       # centralised cache keys
    datetime.ts         # localized date/relative-time helpers
  hooks/                # feature hooks binding repositories to TanStack Query
  types/api.ts          # backend contract types (evolves with backend repo)
  components/
    icons/              # inline SVG icon set (currentColor, aria-hidden)
    ui/                 # design-system primitives (Button, Dialog, …)
    layout/             # AppShell, TopBar, Sidebar, region/notifications/profile menus
    templates/          # TemplateCard + icon mapping
    documents/          # DocumentListItem
    create-document/    # CreateDocumentDialog (template picker)
    guided-flow/        # Guided creation flow stepper, questions, review, polling
  pages/                # route-level screens (+ pages.css)
  test/setup.ts         # Vitest setup (jest-dom, cleanup)
docs/                   # architecture & deployment notes
public/_headers         # Cloudflare Pages security/cache headers
public/_redirects       # Cloudflare Pages SPA fallback
```

## Data layer (Phase 2)

Feature data flows through **repository interfaces**
(`src/lib/repositories/types.ts`) so the UI never talks to `fetch` or fixtures
directly:

- `fixtures` (`VITE_DATA_SOURCE=fixtures`, dev default) — clearly-labeled
  development data persisted to localStorage. A persistent "Dev data" badge
  in the sidebar footer, notifications, Settings and the login page marks
  every surface where fixture content appears. Usage data is **never**
  fabricated — the fixture repository returns `null` and the UI shows an
  "unavailable" state.
- `http` (`VITE_DATA_SOURCE=http`, prod default) — implementations over the
  centralised API client that also document the intended backend contract
  (`/templates`, `/favorites/templates`, `/notifications`, `/organization`,
  `/usage`, `/auth/session`) for the backend repository to implement.

Feature hooks (`src/hooks/*`) bind repositories to TanStack Query with
centralised keys; components consume only those hooks.


## Conventions

- **Components**: one component (or tightly-coupled family) per file,
  `PascalCase.tsx` + co-located `PascalCase.css`; CSS uses BEM-ish classes
  (`btn__icon`, `card__title`). Providers keep their context/hook in
  separate files to stay fast-refresh friendly.
- **Styling**: components consume **semantic tokens only** (`--color-surface`,
  `--space-4`, …) — never raw `--gray-*` primitives or hex values. Status
  colors (`--color-success|warning|error`) are reserved for semantics.
- **API**: components never call `fetch` directly. Use endpoint modules in
  `src/lib/api/endpoints/`; server data flows through TanStack Query
  (`useQuery`/`useMutation`).
- **Secrets**: nothing privileged lives in browser code. Only `VITE_*`
  values are readable client-side and they are public by definition;
  provider/database credentials stay in the backend repo.
- **Types**: `import type` everywhere types are type-only
  (`verbatimModuleSyntax` is on). Strict mode; no `any` by policy.
- **i18n**: all user-visible strings go through `t('key')`; adding a key to
  `en.json` forces adding it to `am.json` (type error otherwise). Amharic
  copy is a native-speaker-review TODO.
- **A11y**: keyboard-operable primitives (focus-visible rings, skip link,
  native `<dialog>`, roving-focus dropdown, `aria-live` toasts). Icon-only
  controls need `aria-label`.

## Environment strategy

`.env.example` documents the contract; `.env.local` (git-ignored) overrides.
`src/config/env.ts` validates and normalises at startup:

| Variable | Meaning | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend base — absolute URL or root-relative path | `http://localhost:8787` (dev) / `/api` (prod) |
| `VITE_DATA_SOURCE` | Feature data layer: `fixtures` or `http` | `fixtures` (dev) / `http` (prod) |
| `VITE_APP_NAME` | Product name in the shell | `DocuA4` |
| `VITE_DEFAULT_LOCALE` | Locale before user preference | `en` |

## Authentication

Phase 2 introduces a session boundary: `SessionProvider` + `RequireSession`
guard the app shell, and the session itself comes from the active repository
(fixture development user, or `/auth/session` over HTTP). Sign-in/out flows
through `useSession`; the API token store remains the single swap point for
future httpOnly cookies.

## Phased roadmap (proposal)

1. **Phase 1 — foundation** (done): shell, tokens, primitives, routing,
   API boundary, i18n, tests, CI-ready scripts.
2. **Phase 2 — dashboard & data layer** (done): repository boundary with
   labeled fixtures, session + route guard, grouped navigation with admin
   gating, dashboard, templates catalogue + detail, favorites, documents,
   organization profile, notifications, global search.
3. **Phase 3 — guided question flow & generation** (done): guided
   question flow wizard; regional and multilingual context (English, Amharic,
   Afaan Oromoo); generation job submission, progressive polling and draft
   synthesis; document creation from templates and editor preview.
4. **Phase 4 — A4 document editor workspace** (done): structured JSON document
   model, contenteditable blocks, allowlist HTML & URL sanitization,
   deterministic A4 pagination & margins, Ethiopic Unicode font fallback and
   probing strategy, debounced autosave with localStorage recovery buffer,
   conflict handling (HTTP 409), print styling and honest export pipeline boundary.
5. **Phase 5**: server-side PDF/DOCX rendering backend service, real auth + accounts.
6. **Phase 6**: template library, sharing, offline/PWA considerations.
