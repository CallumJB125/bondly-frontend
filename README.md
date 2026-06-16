# Bondly Frontend

Two React/Vite frontends for the Bondly platform.

## Sites

| Directory | Platform | Dev URL |
|---|---|---|
| `frontend-src/` | Switch — existing homeowners switching bonds | http://localhost:5173 |
| `frontend-origination/` | First-Time Buyer — new mortgage applications | http://localhost:5174 |

Both sites proxy `/api` calls to `https://bondly.co.za` by default, so no backend setup is needed.

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

## Pointing at a local backend (optional)

If you need to run against a local backend instead of production, set:

```bash
VITE_API_URL=http://localhost:3000 npm run dev
```

## Stack

- React 18 + Vite
- React Router v6
- CSS custom properties (no Tailwind, no CSS-in-JS)
- Feature-based folder structure under `src/features/`
