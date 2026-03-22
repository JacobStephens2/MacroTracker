# Dev Log — 2026-03-22 (Session 3)

## Guest Mode (No-Account Usage)

Added the ability to use the app without creating an account. Guest users get full functionality with data stored locally in the browser's localStorage.

### What was built

**New file: `src/local-db.ts`**
- Complete localStorage-backed data layer mirroring the server API
- Stores foods, meals, recipes, recipe ingredients, and weight logs
- Auto-incrementing IDs for all local records
- Default guest user with sensible macro targets (2000 kcal, 250c/150p/65f)

**Frontend changes:**
- **Login page** — Added "Continue without an account" button with an "or" divider below the login form. Hint text explains data is device-only.
- **`api.ts`** — Each API method checks `isGuestMode()` and routes to the local-db implementation or the server. Food search merges local custom foods with server-side external results (USDA/Open Food Facts). Barcode results are auto-saved to local-db so they can be referenced when logging meals.
- **`main.ts`** — Bootstrap checks for guest mode first and loads the guest user from localStorage without a network call.
- **Settings page** — Guest users see a banner explaining guest mode with links to create an account or sign in. Password and export sections are hidden. Logout becomes "Clear Data & Exit Guest Mode" with a confirmation prompt.
- **`styles.css`** — Styles for auth divider, hint text, and guest settings banner.

**Server changes:**
- **`middleware/auth.ts`** — Added `optionalAuth` middleware that populates `req.user` if a valid token is present but doesn't reject unauthenticated requests.
- **`routes/foods.ts`** — Search, barcode, and save-external endpoints now use `optionalAuth` instead of `requireAuth`, allowing guest users to search the full food database. Local DB food search is skipped when no user is authenticated.

### Guest mode behavior
- Full food search (USDA + Open Food Facts) works — no limits vs. logged-in users
- Barcode scanning works — results saved to localStorage
- Custom foods, recipes, meal logging, weight tracking all work locally
- Profile and macro target edits persist in localStorage
- Only difference from a real account: data is device-only (no cross-device sync, no CSV export)
- Logging in or registering clears any guest data automatically
