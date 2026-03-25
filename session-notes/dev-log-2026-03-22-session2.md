# Dev Log — 2026-03-22 (Session 2)

## Icon 404s fixed

The PWA icons at `/icons/icon-192.png` and `/icons/icon-512.png` were returning 404 in production even though the files existed in the Apache web root.

**Root cause:** Apache's `alias` module has a global `Alias /icons/ "/usr/share/apache2/icons/"` directive that intercepts all requests to `/icons/` before they reach the DocumentRoot. The app's icon files were never served because Apache was looking in its own system icons directory instead.

**Fix:** Renamed `public/icons/` to `public/app-icons/` and updated all references in `index.html`, `vite.config.ts` (manifest icons + `includeAssets`). Rebuilt and redeployed.

## Deprecated meta tag

Replaced `<meta name="apple-mobile-web-app-capable" content="yes">` with `<meta name="mobile-web-app-capable" content="yes">` per Chrome console warning.

## Google Analytics

Added gtag.js snippet with tracking ID `G-2Z5BGPQETM` to `index.html`.

## Food search API timeout

Searches were taking 60+ seconds because Open Food Facts API is extremely slow (18s+ typical, 60s timeout on some endpoints).

**Fix:** Added `AbortSignal.timeout(5000)` to both the Open Food Facts and USDA `fetch()` calls in `server/src/routes/foods.ts`. Since the code already uses `Promise.allSettled`, a timeout on one API gracefully returns results from whichever APIs responded in time.

## Disk space cleanup

Server was at 97% disk usage (1.7 GB free on 48 GB). Removed `~/.cursor-server` from both `/home/jacob` and `/root`, freeing ~3.3 GB (now 5 GB free / 90%).

## Android APK (TWA)

Built an Android APK using Trusted Web Activity, modeled after the existing Creighton Tracker TWA at `/home/jacob/CreightonTrackingApp/android-twa/`.

- Created `android-twa/` project with Gradle build, signing config, and all icon densities
- Generated signing keystore at `android-twa/macros-keystore.jks` (alias: `macros`, password: `macrotracker`)
- Updated `public/.well-known/assetlinks.json` with the real SHA256 fingerprint: `41:F8:38:8D:97:51:BC:8B:57:51:C8:79:7E:D4:2E:3D:C2:F1:5B:2E:B6:01:48:DB:10:48:95:35:D9:FD:48:18`
- Output: `android-twa/macro-tracker-v1.0.0.apk` (921 KB)
- Build command: `JAVA_HOME=~/.bubblewrap/jdk/jdk-17.0.11+9 ANDROID_HOME=~/.bubblewrap/android-sdk ./gradlew assembleRelease`

**Note:** Bubblewrap CLI v1.24.1 is installed globally but its `init` and `build` commands are too interactive for non-TTY use. The project was generated manually instead.

**Note:** The bubblewrap SDK path validation expects `tools/` or `bin/` at the SDK root. A symlink was created: `~/.bubblewrap/android-sdk/bin -> cmdline-tools/latest/bin`.
