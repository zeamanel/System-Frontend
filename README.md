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
| `npm run build` | Type-check (`tsc -b`) + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript project check (strict) |
| `npm run lint` / `lint:fix` | ESLint (flat config) |
| `npm run test` / `test:watch` | Vitest unit/component tests |

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, structure,
  conventions, roadmap
- [`docs/deployment.md`](docs/deployment.md) — Cloudflare deployment guide

## Localization

English (`en`) and Amharic (`am`) ship together. Keys live in
`src/i18n/en.json` (source of truth) and `src/i18n/am.json`. Missing keys
fail the type-check. Switch language from the top bar or Settings.
