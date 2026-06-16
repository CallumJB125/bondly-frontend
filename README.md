# Bondly Frontend

Two React/Vite frontends for the Bondly platform, sharing a common design system.

## Sites

| Directory | Platform | Local dev (your machine) | Live (Netlify) |
|---|---|---|---|
| `frontend-src/` | Switch — existing homeowners switching bonds | http://localhost:5173 | https://bondly-frontend-src.netlify.app |
| `frontend-origination/` | First-Time Buyer — new mortgage applications | http://localhost:5174 | https://bondly-origination.netlify.app |

Both sites proxy `/api` calls to `https://bondly.co.za`, so no backend setup is needed. You'll need a test account on bondly.co.za to log in and view authenticated screens.

## Shared design system

`shared/` (`@bondly/ui`) holds the synced design tokens, base styles, UI components, and utility libraries used by both apps. See [shared/README.md](shared/README.md) for details.

```js
import Button from '@bondly/ui/components/Button.jsx';
import { fmt } from '@bondly/ui/lib/format.js';
```

App-specific code (API client, navigation, feature pages) stays in each frontend directory.

## Setup

```bash
# Switch platform
cd frontend-src
npm install
npm run dev        # → http://localhost:5173

# First-Time Buyer platform
cd frontend-origination
npm install
npm run dev        # → http://localhost:5174
```

`localhost:5173` / `5174` are local dev servers running on **your machine only** — they are not deployed anywhere.

## Deploy workflow

```
edit code → push to main → Netlify auto-rebuilds the live .netlify.app sites (~15s)
```

Every push to `main` automatically redeploys both Netlify sites. Use the live URLs above to share and review changes.

## Stack

- React 18 + Vite
- React Router v6
- CSS custom properties (no Tailwind, no CSS-in-JS)
- Feature-based folder structure under `src/features/`
- Shared UI package at `shared/` imported via `@bondly/ui`
