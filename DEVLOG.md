# Dev Log — 2026-03-22

## Summary

Built and deployed the Macro Tracker PWA from scratch in a single session. The app replaces a $20/month MyFitnessPal subscription with a self-hosted alternative at https://macros.stephens.page.

## What was built

### Core app (initial commit)
- TypeScript + Vite frontend, Express + SQLite backend
- Email/password auth with verification and password reset via Mandrill SMTP
- Daily dashboard with calorie ring, carbs/protein/fat progress bars
- Meal logging by type (breakfast/lunch/dinner/snack)
- Food search via Open Food Facts and USDA FoodData Central APIs
- Barcode scanner using device camera (html5-qrcode)
- Custom food creation
- Recipe management (build from ingredients)
- Weight tracking with Chart.js trend chart
- Configurable daily targets (default: 340g carbs, 150g protein, 70g fat, 2590 kcal)
- PWA with service worker, installable and TWA-ready
- Apache reverse proxy, Let's Encrypt SSL, systemd service

### Improvements added after initial deploy
- **Auto-calculate calories** from macros (carbs×4 + protein×4 + fat×9) in custom food and quick add forms
- **Remaining macros display** — "Xg remaining" under each progress bar and "X kcal remaining" summary
- **Per-meal targets** — each meal section shows current/target macros, color-coded green/yellow/red
- **Copy previous day** — one-tap button to duplicate all meals from yesterday
- **Digital Asset Links** for TWA (sha256 fingerprint configured)
- **Dark mode** — automatic via prefers-color-scheme
- **CSV export** — download meal logs and weight data from Settings
- **Swipe-to-delete** on meal entries with smooth collapse animation
- **Manual macros on recipes** — toggle between "From Ingredients" and "Manual Macros" modes
- **Serving unit on recipes** — custom units like "cup", "bowl", "scoop"
- **Tap-to-edit** on logged meal entries — adjust servings, change meal type, or delete
- **Search indicator** — pulsing green glow on search inputs while fetching results
- **USDA food measures** — unit dropdown in add-to-meal modal (e.g. "1 banana", "1 cup", "1 slice")
- **Ingredient unit picker** — same modal for recipe ingredients with macro preview
- **Persisted unit labels** — unit choices saved to DB so "1 banana" survives page reload
- **Legacy measure detection** — auto-matches old ingredient data to USDA measures on load
- Favicon, README, deployment docs

## Bugs fixed
- Loading spinner not clearing on recipes tab in food log
- Search animation not showing on recipe ingredient search (CSS specificity issue with `background` shorthand overriding `background-image`)
- Search animation too subtle (replaced gradient underline with pulsing box-shadow glow)

## Tech decisions
- **Hash-based routing** (`#/login`, `#/recipes/2`) — no server-side routing needed, Apache serves static files directly
- **JWT in httpOnly cookies** — same auth pattern as the Creighton Tracker app
- **SQLite with auto-migration** — schema creates on first run, new columns added via PRAGMA checks on restart
- **USDA API key** set in systemd environment (not in code)
- **Measures stored as JSON** on foods table — avoids a separate measures table while supporting the unit picker
- **Unit label + qty persisted** on recipe_ingredients — preserves human-readable unit choices across sessions

## File structure
```
MacroTracker/
├── index.html, package.json, tsconfig.json, vite.config.ts
├── public/
│   ├── favicon.png, app-icons/
│   └── .well-known/assetlinks.json
├── src/
│   ├── main.ts, router.ts, api.ts, state.ts, types.ts, styles.css
│   ├── views/ (auth, dashboard, log-food, recipes, weight, settings)
│   └── components/ (nav)
├── server/
│   ├── package.json, tsconfig.json
│   └── src/
│       ├── index.ts, db.ts
│       ├── middleware/auth.ts
│       └── routes/ (auth, foods, meals, recipes, weight)
├── README.md, DEPLOYMENT.md, DEVLOG.md
└── macros-pwa-prompt.md (original prompt)
```

## Deployment
- Frontend: `/var/www/macros.stephens.page/` (Vite build output)
- Backend: systemd `macros-api.service` on port 3457
- Apache proxies `/api` to Node.js, serves static files for everything else
- SSL via Let's Encrypt (auto-renewing)
- DB at `/home/jacob/MacroTracker/server/data/macros.db`

## 29 commits, ~14,000 lines of code
