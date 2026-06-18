# Bondly Brand Bible

The single visual source-of-truth for designing Bondly pages and components. The **landing page**
(`frontend-src/src/features/landing/Landing.jsx` + `Landing.css`) is the gold standard — when in
doubt, open it and copy how it does the thing. This file distills that standard into rules.

> **Authority order:** `shared/styles/tokens.css` (exact values) → this bible (rules + recipes) →
> `Landing.css` (reference implementation) → `AGENTS.md` (workspace/process) → `varodesignstyle/DESIGN.md`
> (philosophy only; it predates the navy shift — ignore its violet values).

---

## 0. The one-paragraph soul

Bondly is **Varo "poster-zine" fintech**: bold, ultra-compressed display headlines on white and flat
colour bands, **navy `#1e3a5f` as the only interactive colour**, **1px hairline black borders**, a hard
**4px radius**, and **zero shadows**. Depth comes from *flat colour collision and hairline strokes*, never
from elevation. The feeling is calm, editorial, premium, trustworthy, and warm — a serious money brand
that doesn't shout. Restraint over decoration. If a screen looks busy, glossy, gradient-heavy, drop-
shadowed, or rounded-and-bubbly, it is **off-brand**.

---

## 1. Colour

Navy is **sacred** — it is the interactive colour (filled buttons, active links, logo, slider fills,
focus rings, stat figures). Cream / salmon / lemon / gold are **decorative section fills only** — never
a button or link colour. Never the reverse.

### Core tokens (from `tokens.css`, available globally)
| Token | Hex | Role |
|---|---|---|
| `--brand` | `#1e3a5f` | **Navy** — primary action, interactive only |
| `--brand-dark` | `#152d4a` | Navy hover/darken |
| `--brand-light` | `#e8eef5` | Soft navy fill / selected / ghost-hover |
| `--brand-deep` | `#0e1b2e` | Deep-navy trust/CTA bands |
| `--cream` | `#faefdc` | Butter-cream — warm alt section band |
| `--salmon` | `#f2a295` | Salmon-wash — warm colour band |
| `--lemon` | `#fdf0af` | Lemon-zest — accent text/figures on dark |
| `--gold` (`--ls-gold`) | `#e2c87d` | Wheat-gold — stat figures on dark, fine accents |
| `--gold-light` (`--ls-gold-light`) | `#f3e2b0` | Light gold highlight |
| `--text-primary` | `#111111` | Body / headings on light |
| `--text-secondary` | `#6b7280` | Secondary copy |
| `--text-muted` | `#9ca3af` (landing uses `#5a5a5a` `--ls-muted`) | Muted labels |
| `--border` / `--carbon` | `#000000` | Hairline borders, structural ink |
| `--bg-white` | `#ffffff` | Default page/canvas |
| `--bg-subtle` | `#f3f2ef` | Quiet inset surface |
| Section blue | `#F2F6FC` | The landing's light-blue section band (`#how-it-works`, `.ls-banks`) |
| FAQ off-white | `#fbfcfe` | FAQ section background |
| `--ls-heading` | `#06143b` | Near-black navy for headings on light |

### Status colours (use only for genuine status, never decoration)
`--color-success #16a34a` · `--color-error #dc2626` · `--color-warning #d97706` · `--color-info #2563eb`.

### Section-background rhythm (how the landing alternates)
White → (navy band for proof) → light-blue `#F2F6FC` → white → light-blue → off-white `#fbfcfe` →
deep-navy CTA card → white footer. **Alternate white with one tinted band**; never stack two saturated
bands back-to-back. A page may use a cream/salmon band for warmth, but sparingly.

### Hard NO
- ❌ Navy (or deep-navy) as a decorative full-section fill *for its own sake* — it reads as a CTA/trust
  band, so only use it where that meaning is intended (proof band, final CTA).
- ❌ Any hex outside this palette (no teal/`--mint` legacy, no random reds/oranges, no purple).
- ❌ Gradients as decoration. The only gradients in the system are: the hero photo navy-scrim overlay,
  the gradient-clipped hero `em` text, and the dark stat-panel's subtle radial+linear. Don't invent new ones.
- ❌ Hardcoding a hex when a token exists. Use `var(--token)`.

---

## 2. Typography

**Two families only.** Never add a third. Never use serif/mono/handwriting.
- `--font-display` = **Neue Haas Grotesk Display** → all headlines, big figures, step numbers, FAQ
  questions, the logo. Apply via class `.ls-serif` on the landing (despite the name, it's the display
  sans). Always tight: `letter-spacing: -0.01em` to `-0.02em`, `line-height: 0.9–1.05`.
- `--font-sans` = **Neue Haas Grotesk Text** → body / UI default.
- `--ls-subtext` = **Plus Jakarta Sans** → longer paragraph/sub copy (hero sub, section subs, FAQ
  answers, stat detail). Used for readable secondary prose only.

### Type scale (lifted from `Landing.css` — match these)
| Role | size | weight | line-height | tracking |
|---|---|---|---|---|
| Hero H1 | `clamp(36px, 6.5vw, 72px)` | 600 | 0.92 | -0.02em |
| Section H2 | `clamp(36px, 5vw, 2.7rem)` | 600 | 0.95 | -0.01em |
| Big section title (banks) | `clamp(30px, 3.5vw, 44px)` | 600 | 1.02 | -0.015em |
| FAQ title | `clamp(34px, 4vw, 2.6rem)` | 700 | 0.98 | -0.02em |
| Card/calc title | 22px | 700 | 1.15 | -0.01em |
| Step/section sub-title | 20px | 600/700 | — | — |
| FAQ question | 18px | 600 | — | -0.01em |
| Hero sub | 17.5px | — | 1.5 | — |
| Section sub | 17px | — | 1.5 | — |
| Body | 15px | — | 1.5–1.6 | — |
| Secondary/detail | 13.5–14.5px | — | 1.4–1.5 | — |
| Eyebrow/kicker | 14px | 500 | — | 0.04em |
| Label (uppercase) | 12px | 600–700 | — | 0.10–0.14em |
| Big figure (light) | 52–64px display | 700 | 0.9 | -0.01em |
| Big figure (on dark) | `clamp(40px, 4.2vw, 58px)` | 700 | 0.82 | -0.02em |

- **Figures use `font-variant-numeric: tabular-nums`** (currency, stats, slider values).
- Headlines wrap *short* — cap with `max-width: 17–22ch`. Big type that wraps to 5–6 lines is wrong.
- Every major section opens with a small **kicker/eyebrow** (`.ls-eyebrow` / `.ls-sec-eyebrow`) above
  the H2 — `14px / 0.04em`, often with a 26×2px navy tick before it.

---

## 3. Spacing & layout

- **Container:** `.ls-wrap` = `max-width: 1200px; margin: 0 auto; padding: 0 32px;` (→ `0 20px` ≤640px).
  (Global `--container-max` is `1120px`; the landing uses 1200 — match the landing for landing-grade pages.)
- **Section rhythm:** `padding: 88px 0` desktop → `56px 0` ≤640px (`.ls-section`).
- **Spacing scale:** use `--space-1…24` (4px base: 4,8,12,16,20,24,28,32,40,48,…,96). Don't invent
  off-scale paddings.
- **Signature grids (copy these ratios):**
  - Hero: `grid-template-columns: 1.15fr .85fr; gap: 72px;` → single column ≤960px. **Keep this
    asymmetry even when the right panel is a form/card** — the copy column must dominate (≈1.15/.85),
    never drift to a near-50/50 split. If you don't have a strong right-hand element, use a
    single-column / centered hero instead, but don't flatten the signature ratio.
  - 3-up steps: `repeat(3, 1fr); gap: 24px;` → 1 column ≤960px.
  - Split intro + panel (banks): `1fr 1.05fr; gap: 56px;` → 1 column ≤960px.
  - FAQ: `minmax(0,0.85fr) minmax(0,1.4fr); gap: 64px;` with a `position: sticky; top: 96px` heading.
  - Two-card case study: `1fr 1fr` inside one hairline-bordered box, divider border between halves.
- **Bento stagger (optional flourish):** offset even tiles `transform: translateY(28px)` to break grid
  lockstep; reset to `none` ≤640px (see `.ls-banks__stat:nth-child(2n)`).
- Every page = **sticky `LandingNav` at top + landing `Footer` at bottom** unless there's a reason not to.

---

## 4. Components (copy-ready recipes)

All live in `Landing.css` under `.ls-*`. Reuse the actual classes where you can; when you build a new
feature, prefix your own classes (e.g. `.contact-`) but mirror these exact values.

**Buttons** (`.ls-btn`): `border-radius: 4px; border: 1px solid #000; font-weight: 600; gap: 8px;
transition: …18s ease`.
- Primary: `background: var(--brand); color:#fff; border-color: var(--brand); padding: 12px 24px;
  font-size:15px`. **Hover inverts** → transparent bg, navy text/border.
- Ghost: transparent, `#111` text, `padding:12px 22px`; hover fills `--brand-light`.
- Large: `padding: 15px 30px; font-size:16px` (`.ls-btn--lg`).
- On dark bands, the primary can flip to lemon fill with deep-navy text (see `.ls-final`).

**Inputs** (`.ls-input` / `.ls-field`): label `13px/600`, then a `1px solid #000`, `4px` radius box,
`padding: 12px 14px`, `font-size: 15.5px`. **Focus:** `border-color: var(--brand); box-shadow: 0 0 0 3px
rgba(30,58,95,.15)`. Strip number spinners. Use the `--focus-ring` token for keyboard focus elsewhere.

**Pill / badge** (`.ls-pill`): `border-radius: 999px; background: var(--brand-light); color: var(--brand);
font-size:12px; weight 600; padding: 5px 12px 5px 10px; gap:6px`. (Pills are the *only* 999px-radius UI
besides genuine circles.)

**Card / panel:** white, `border: 1px solid #000` (hairline), `border-radius: 4px` (the calc card and FAQ
items use 14px as a deliberate soft exception — keep new cards at 4px unless matching those specific
patterns). **No shadow.**

**FAQ accordion** (`.ls-faq__*`): rows divided by `1px solid #e3e8f0`; open row gets navy border + white
bg; question is display face `18px/600`; the `+` icon sits in a `30px` circle and rotates `135deg` on open
with `transition: transform .4s cubic-bezier(0.22,1,0.36,1)`; panel animates height 0→auto via Framer
Motion (`EASE_SILK = [0.22,1,0.36,1]`, height .42s, opacity .32s delay .06s). Respect `useReducedMotion()`.

**Stat panel on dark** (`.ls-banks__panel`): the one place with a real shadow + 16–24px radii — a navy
glass bento. Tiles `rgba(255,255,255,.045)` bg, `1px rgba(255,255,255,.07)` border, gold figures
(`--gold`), gold tick `::before`. Use only for a hero-grade stat moment, not everywhere.

**Nav (`LandingNav`) & Footer:** import and reuse `frontend-src/src/features/landing/LandingNav.jsx` and
copy the landing `Footer`. Nav is `64px`, sticky, white, hairline bottom border, navy logo with `⌂` mark.

---

## 5. Effects, motion, a11y

- **Radius:** everything `4px` (`--radius`). `--radius-full` (9999) only for genuine circles (avatars,
  spinner, pills). The calc card / FAQ item / dark stat panel use 14–24px as deliberate, named exceptions.
- **Borders:** `1px solid #000` hairlines for structure/separation. Subtle inner dividers may use
  `#e3e8f0`/`#e3e9f1`.
- **Shadows:** **none** (`--shadow* = none`). The three sanctioned exceptions, copy verbatim only if you're
  building that exact element: slider thumb `0 1px 3px rgba(14,27,46,.25)`; dark stat panel `0 40px 80px
  -48px rgba(6,20,59,.7)`; bank chip near-zero `0 1px 2px rgba(16,24,40,.04)`. Don't add others.
- **Motion:** one easing curve — `--ease-out: cubic-bezier(0.22,1,0.36,1)`. Durations 150–400ms, never
  bouncy. Transitions `--transition-fast/base/slow`. Always honour `prefers-reduced-motion` (tokens.css
  already zeroes it globally; in JS use Framer's `useReducedMotion()`).
- **Focus:** visible focus rings (`--focus-ring`) on interactive elements. Provide `aria-*`, `alt`, and
  semantic landmarks (`header/nav/section/footer`). Keep colour contrast AA.

---

## 6. Pre-flight checklist (run before declaring any page done)

1. Two type families only; headlines display-face, tight leading, short wraps, kicker above each H2.
2. Navy used for interactive only; bands are cream/salmon/lemon/light-blue; no off-palette hex; no
   hardcoded values that have tokens.
3. 4px radius everywhere (named exceptions aside); 1px black hairlines; **no stray shadows**.
4. `.ls-wrap` 1200/32 container; 88px section rhythm; signature grids; responsive at 960 / 640.
5. `LandingNav` + landing `Footer` present; sticky nav; kicker→H2→sub→content section pattern.
6. Tabular-nums on figures; AA contrast; reduced-motion respected; focus rings; alt text.
7. At least one **crafted visual** (generated image *or* non-trivial SVG infographic) per the Visual
   Asset Protocol — and it looks human-made, not AI-sloppy.
8. Screenshot at mobile (390) + large (1440) and actually look at both before saying "done".
