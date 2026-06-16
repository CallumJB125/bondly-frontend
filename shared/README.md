# @bondly/ui — Shared design system

Single source of truth for Bondly's two frontends (`frontend-src` and `frontend-origination`).

## What's shared

| Path | Contents |
|---|---|
| `styles/` | `tokens.css`, `base.css` — design tokens and global styles |
| `components/` | Button, Card, Input, Modal, Toast, Skeleton, StatementLoader, RatesExplained, FeedbackButton, PropertySearchCTA |
| `lib/` | analytics, constants, errors, finance, format, mortgage, propertyLinks, session, usePrimeRate |

## What's app-local

Each app keeps its own:

- `src/lib/api.js` — API client (endpoints differ slightly)
- Navigation (`Nav.jsx` / `OriginationNav.jsx`)
- Feature pages, dashboards, landing experiences
- Switch-only widgets (ChatWidget, StickyCtaBar, etc.)

## Usage

Both Vite apps resolve `@bondly/ui` to this folder:

```js
import Button from '@bondly/ui/components/Button.jsx';
import { fmt } from '@bondly/ui/lib/format.js';
import '@bondly/ui/styles/tokens.css';
```

Changes here automatically apply to both Netlify deploys on the next build — no runtime coupling between sites.
