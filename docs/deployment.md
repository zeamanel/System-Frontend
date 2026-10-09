# Deploying to Cloudflare

The frontend builds to a **fully static bundle** (`dist/`), which makes
Cloudflare **Pages** the natural first deployment target. The choice between
Pages and Workers (static assets + Workers for React SSR or edge functions)
was deliberately deferred: nothing in Phase 1 requires server-side
rendering, and the backend lives in a separate repository.

## Pages setup (recommended today)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages** →
   *Connect to Git* and select this repository.
2. Build configuration:
   - **Framework preset**: Vite (or none — values below are what matter)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node version**: set `NODE_VERSION = 22` environment variable
     (or rely on `.nvmrc`, committed at the repo root).
3. Environment variables (Production & Preview): set `VITE_API_BASE_URL`
   to the deployed backend origin, e.g. `https://api.docua4.example`.
   Add others from `.env.example` as needed. Only `VITE_*` values are
   bundled — never put secrets in them.
4. SPA routing: `public/_redirects` (`/* /index.html 200`) ships with the
   build so client-side routes resolve on hard refresh.
5. Security & caching headers ship via `public/_headers`.

CLI alternative:

```sh
npm ci && npm run build
npx wrangler pages deploy dist --project-name=docua4-frontend
```

## Same-origin API option

Point `VITE_API_BASE_URL` at a root-relative path (e.g. `/api`) and add a
Pages proxy rule (or a Pages Function `/api/*` that forwards to the backend)
to avoid a second origin and CORS entirely. This is the expected setup when
the backend is a separate Cloudflare Worker.

## When to revisit Workers vs Pages

Choose Workers (with static assets) instead of Pages only when we adopt
server-side rendering, need edge middleware in this repo, or Cloudflare
consolidates the two further. The static build works on both; nothing in the
codebase is Pages-specific.
