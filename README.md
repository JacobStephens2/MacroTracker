# Macro Tracker

A self-hosted macronutrient tracking PWA built to replace MyFitnessPal. Track daily carbs, protein, fat, and calories with per-meal breakdowns, food search, barcode scanning, recipe management, and weight tracking over time.

Live at **https://macros.stephens.page**

## Features

- **Daily macro dashboard** — calorie ring, carbs/protein/fat progress bars with remaining totals, per-meal targets with color coding
- **Meal logging** — breakfast, lunch, dinner, snacks with per-meal subtotals
- **Food search** — combo search across Open Food Facts and USDA FoodData Central APIs
- **Barcode scanner** — scan packaged foods using device camera
- **Custom foods** — create your own foods with manual macro entry, auto-calculated calories
- **Recipes** — build from ingredients or enter macros manually, custom serving units
- **Weight tracking** — log weight with trend chart (Chart.js)
- **Copy previous day** — one-tap meal duplication for repetitive diets
- **Tap to edit, swipe to delete** — touch-friendly meal management
- **CSV export** — download meal logs and weight data
- **Dark mode** — automatic via `prefers-color-scheme`
- **Email/password auth** — with email verification and password reset (Mandrill SMTP)
- **PWA** — installable, service worker for fast loading, TWA-ready for Google Play

## Tech Stack

- **Frontend:** TypeScript, Vite, Chart.js, html5-qrcode, vite-plugin-pwa
- **Backend:** Node.js, Express, better-sqlite3, JWT (httpOnly cookies), bcrypt, nodemailer
- **Hosting:** Apache (reverse proxy), Let's Encrypt SSL, systemd

## Development

```bash
# Frontend
npm install
npm run dev          # Vite dev server on :5173, proxies /api to :3457

# Server
cd server
npm install
npx tsc              # Compile TypeScript
node dist/index.js   # Runs on :3457
```

Environment variables for the server (set in systemd service or `.env`):

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret for signing JWTs |
| `PORT` | Server port (default: 3457) |
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From email address |
| `APP_URL` | Public URL (for email links) |
| `USDA_API_KEY` | USDA FoodData Central API key |

## Deploy

```bash
# Frontend
npm run build
sudo cp -r dist/* /var/www/macros.stephens.page/

# Server
cd server
npx tsc
sudo systemctl restart macros-api
```

## License

Personal project. Not licensed for redistribution.
