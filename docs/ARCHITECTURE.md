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
  App.tsx               # provider composition (Query → I18n → Toast → Router)
  routes.tsx            # central route table, lazy pages
  config/env.ts         # typed, validated VITE_* environment access
  styles/
    tokens.css          # ALL design tokens (semantic, monochrome)
    base.css            # reset + element defaults + a11y utilities
  i18n/                 # locales, typed resources, provider, hook
  lib/
    api/                # API-client boundary (client, auth store, endpoints)
    query-client.ts     # TanStack Query defaults
  types/api.ts          # backend contract types (evolves with backend repo)
  components/
    icons/              # inline SVG icon set (currentColor, aria-hidden)
    ui/                 # design-system primitives (Button, Dialog, …)
    layout/             # AppShell, TopBar, Sidebar, Logo
  pages/                # route-level screens (+ pages.css)
  test/setup.ts         # Vitest setup (jest-dom, cleanup)
docs/                   # architecture & deployment notes
public/_headers         # Cloudflare Pages security/cache headers
public/_redirects       # Cloudflare Pages SPA fallback
```

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
| `VITE_APP_NAME` | Product name in the shell | `DocuA4` |
| `VITE_DEFAULT_LOCALE` | Locale before user preference | `en` |

## Authentication

Not implemented in Phase 1 (no backend yet). The boundary is prepared:
`lib/api/auth-store.ts` (single place to swap localStorage for httpOnly
cookies) and `lib/api/endpoints/auth.ts` (typed sign-in/out/session calls).

## Phased roadmap (proposal)

1. **Phase 1 — foundation** (this): shell, tokens, primitives, routing,
   API boundary, i18n, tests, CI-ready scripts.
2. **Phase 2**: document-type catalogue + guided question flow; generation
   job submission/polling; document list with real data.
3. **Phase 3**: A4 canvas editor (contenteditable blocks), autosave,
   versioning.
4. **Phase 4**: print/export pipeline (PDF), auth + accounts.
5. **Phase 5**: template library, sharing, offline/PWA considerations.
