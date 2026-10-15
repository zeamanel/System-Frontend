# DocuA4 — Frontend

AI-assisted document creation workspace for Ethiopia: choose a document
type, answer guided questions, generate a draft with AI, then edit, save and
print it on an A4 canvas.

This repository contains the **frontend only**. The backend lives in a
separate repository and is accessed exclusively through the typed API client
in `src/lib/api/`.

## Requirements

- Node.js 20–22 (`.nvmrc` pins 22)
- npm 10+

## Getting started

```sh
npm install
cp .env.example .env.local   # adjust VITE_API_BASE_URL if needed
npm run dev                  # http://localhost:5173
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | i18n parity check + type-check (`tsc -b`) + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript project check (strict) |
| `npm run check:i18n` | i18n key-parity check across locale files |
| `npm run lint` / `lint:fix` | ESLint (flat config); `lint` also runs `check:i18n` |
| `npm run test` / `test:watch` | Vitest unit/component tests |

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, structure,
  conventions, roadmap
- [`docs/deployment.md`](docs/deployment.md) — Cloudflare deployment guide

## Localization

English (`en`) and Amharic (`am`) ship together; Afaan Oromoo (`om`) is
selectable with English interface strings and a visible notice in the
language menu. Keys live in `src/i18n/en.json` (source of truth),
`src/i18n/am.json`, and `src/i18n/om.json` (English placeholder). Key
parity across locales is enforced by `npm run check:i18n`, which runs as
part of `npm run build`. Switch language from the top bar or Settings.
