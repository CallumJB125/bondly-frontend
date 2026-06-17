# AGENTS.md — Bondly Frontend

Orientation for AI agents working in this repo. Read this first. It tells you **where to work**, **how the design system flows**, **the design rules to follow**, and **the task workflow** (which ends in visual verification with Puppeteer).

---

## 1. Workspace map

This is a **monorepo** of two independent React + Vite apps that share one design system. There is no root `package.json` — each package installs and runs on its own.

| Path | What it is | Dev port |
|---|---|---|
| `frontend-src/` | **Switch platform** (homeowners switching their bond). **This is the primary surface for current design work.** | `5173` |
| `frontend-origination/` | First-Time-Buyer platform (new mortgage applications). | `5174` |
| `shared/` | `@bondly/ui` — the shared design system (tokens, base styles, fonts, components, lib). Imported by **both** apps. | — |
| `varodesignstyle/DESIGN.md` | The full design-philosophy reference (the "Varo poster-zine" system). | — |
| `frontend/` | Build output of `frontend-src` (generated — do not edit). | — |
| `frontend-origination-dist/` | Build output of `frontend-origination` (generated — do not edit). | — |

Both apps resolve the alias `@bondly/ui` → `../shared` (see each app's `vite.config.js`). Netlify auto-deploys each app on push to `main`; the two sites are static with no runtime coupling.

> **Default assumption:** unless told otherwise, design changes happen in **`frontend-src`**.

---

## 2. Where to make design changes

- **App-specific UI** → `frontend-src/src/features/<feature>/`. Features are self-contained: a `Feature.jsx` with a **co-located `Feature.css`** (e.g. `features/landing/Landing.jsx` + `Landing.css`). Some features add local `components/` and `hooks/` subfolders (e.g. `dashboard/`, `admin/`).
- **Cross-cutting / system-wide UI** (a token, a base utility, a reusable component) → `shared/`.
- ⚠️ **A change in `shared/` affects BOTH apps.** Confirm it should land in both before editing there. If only `frontend-src` should change, keep it app-local.
- App-local (not shared) lives under `frontend-src/src/`: `components/` (e.g. `Nav.jsx`), `context/`, `lib/` (e.g. `api.js`, locale helpers).

---

## 3. Design tokens & how they flow

Tokens are defined **once** and consumed everywhere via CSS custom properties. There is **no Tailwind and no CSS-in-JS** — it is plain CSS plus `var(--token)`.

| File | Role |
|---|---|
| `shared/styles/tokens.css` | **Source of truth.** All colors, type scale, spacing, radius, transitions as `:root` custom properties. |
| `shared/styles/base.css` | Global reset, base typography, layout containers, utility classes (`.container`, `.flex`, `.pill`, `.section`, …). |
| `shared/styles/fonts.css` | `@font-face` for the self-hosted Neue Haas Grotesk families (`shared/fonts/*.otf`). |

**Rules**
- **Never hardcode** a hex color or px value when a token exists — use `var(--token)`.
- Adding a value used in more than one place? Add a token in `tokens.css` first, then reference it.
- Key token groups: brand/interactive (`--brand` = navy `#1e3a5f`, `--brand-dark`, `--brand-deep`), decorative bands (`--cream`, `--salmon`, `--lemon`, `--lime-pulse`, `--forest-ink`, `--coral`), text (`--text-primary/secondary/muted`), borders (hairline black), type (`--font-display`, `--font-sans`, `--text-xs`…`--text-5xl`), spacing (`--space-1`…`--space-24`), radius (all `4px` except `--radius-full`).

---

## 4. Components

Reusable components live in `shared/components/` — each is a `.jsx` with co-located `.css`:
`Button`, `Card`, `Input`, `Modal`, `Skeleton`, `Toast`, `StatementLoader`, `RatesExplained`, `FeedbackButton`, `PropertySearchCTA`.

Import via the alias:

```js
import Button from '@bondly/ui/components/Button.jsx';
import { fmt } from '@bondly/ui/lib/format.js';
import '@bondly/ui/styles/tokens.css';
```

**Prefer reusing a shared component over building a one-off.** Only build app-local UI when the need is genuinely specific to one app.

Shared utilities in `shared/lib/`: `analytics`, `constants`, `errors`, `finance`, `format`, `mortgage`, `propertyLinks`, `session`, `usePrimeRate`.

---

## 5. Design protocols

The system is the **Varo "poster-zine"** aesthetic: bold compressed display type on white/colored bands, hairline black borders, flat (no shadows). Full reference: `varodesignstyle/DESIGN.md`.

> ⚠️ **`tokens.css` overrides DESIGN.md on specifics.** DESIGN.md was authored when the interactive color was violet `#8c58d0`; the live system has moved to **navy `#1e3a5f`**. Treat DESIGN.md as the philosophy/structure reference and `shared/styles/tokens.css` as the authority for actual values.

**Do**
- Use the **display face** (`var(--font-display)`, Neue Haas Grotesk Display) for large headlines with **tight leading** (line-height ~0.92–0.98).
- Use **navy `--brand` for interactive elements only** — filled primary buttons, active nav, links.
- Stick to **two type families**: display for headlines, `--font-sans` (Text) for body. Never add a third.
- Keep **all radii at 4px** (`--radius*`); `--radius-full` only for genuine circles (avatars).
- Use **1px hairline black borders** for separation. Depth comes from flat color collision, not elevation.
- Anchor sections with a small **kicker label** above the display headline.
- Tighten letter-spacing on large type (`-0.01em`+).

**Don't**
- ❌ No shadows, blur, or multi-layer elevation (`--shadow*` are `none` by design).
- ❌ Don't use navy as a decorative section fill — it's interactive only. Use cream/salmon/lemon/lime/forest for bands.
- ❌ No pill buttons or radii > 4px.
- ❌ No serif/monospace/handwriting fonts; no browser-default link colors.
- ❌ Don't hardcode values that have a token.

**Naming convention:** BEM-ish with a hyphen namespace per scope — block `.btn`, element `.card__body`, modifier `.btn--lime`. Feature/component stylesheets prefix their classes to avoid global collisions (e.g. `.ls-` for Landing, `.nav-` for Nav). Follow the prefix already used by the file you're editing.

---

## 6. Task workflow

1. **Locate** the feature/component (`frontend-src/src/features/<feature>/`, or `shared/` if system-wide).
2. **Reuse** existing tokens (`tokens.css`) and shared components before writing anything new.
3. **Edit** the co-located `.css` (and `.jsx` as needed). Match the file's existing class-prefix and conventions.
4. **Run** the dev server: `cd frontend-src && npm run dev` (→ `http://localhost:5173`).
5. **Visually verify** with Puppeteer at **mobile + large** (see §8). Read the generated PNGs back and check the change at both viewports.
6. **Check tests**: `npm run test` (Vitest) still passes.
7. Iterate until it matches the design protocols at every viewport.

---

## 7. Commands

Run from inside the app folder (`frontend-src/` unless stated). Package manager is **npm**.

| Command | What it does |
|---|---|
| `npm install` | Install deps (run once per app). |
| `npm run dev` | Dev server — `frontend-src` on `:5173`, `frontend-origination` on `:5174`. |
| `npm run build` | Production build. |
| `npm run test` | Unit tests (Vitest). `npm run test:watch` for watch mode. |
| `npm run shot` | **Puppeteer screenshots** for visual verification (see §8). `frontend-src` only. |

---

## 8. Visual verification with Puppeteer

Visual checks use **Puppeteer** (`frontend-src/scripts/screenshot.mjs`, run via `npm run shot`). It captures **full-page** screenshots at multiple viewports so you verify both ends of the responsive range. Default viewports: **mobile (390×844)** and **large (1440×900)**; `xl` is 1920×1080.

**Prerequisite:** the dev server must already be running (`npm run dev`).

```bash
npm run shot                       # "/" at mobile + large
npm run shot -- / /compare         # multiple routes
npm run shot -- / --all            # mobile + large + xl
npm run shot -- /dashboard --mobile  # a single viewport
npm run shot -- / --base=http://localhost:5174   # screenshot the origination app
npm run shot -- / --out=.screenshots/before      # custom output dir (e.g. before/after)
```

Images are written to `frontend-src/.screenshots/` (git-ignored), named `<route>-<viewport>.png`. After running, **Read the PNG files back** to confirm the change renders correctly at each viewport. For before/after comparisons, capture into separate `--out` folders.

---

## 9. Conventions & gotchas

- **npm only** (no yarn/pnpm). No root `package.json` — install/run per app.
- **No Tailwind, no CSS-in-JS** — plain CSS + tokens, co-located per component.
- **`shared/` is global** — edits hit both apps.
- **Locale:** South-African formatting (Rand, dates, number spacing) lives in `shared/lib/format.js` — use it, don't reinvent.
- **Don't edit build output** (`frontend/`, `frontend-origination-dist/`).
- No ESLint/Prettier/TypeScript config exists — match the style of the surrounding file.
