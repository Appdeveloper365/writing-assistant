# Writing Assistant — Release Packages (v0.1.0)

Built 2026-09-02 from `C:\Users\bala\writing-assistant`.

## 1. Chrome — `writing-assistant-0.1.0-chrome.zip`
- **Test locally:** unzip, then `edge://extensions` → nothing needed; for Chrome: `chrome://extensions` → enable Developer mode → "Load unpacked" → select the unzipped folder (or use `.output/chrome-mv3/`).
- **Publish:** upload the zip at https://chrome.google.com/webstore/devconsole (one-time $5 developer fee). You'll need: 128px icon, screenshots, privacy policy URL (see `PRIVACY-SECURITY.md`).

## 2. Edge — `writing-assistant-0.1.0-edge.zip`
- **Test locally:** `edge://extensions` → Developer mode → "Load unpacked" → select unzipped folder.
- **Publish:** upload at https://partner.microsoft.com/dashboard/microsoftedge (free). Same listing assets as Chrome.

## 3. Outlook add-in — `outlook-addin/`
- Contents: `manifest.xml`, `taskpane.html`, `taskpane.js`.
- **Hosting required:** the taskpane files must be served over HTTPS. `manifest.xml` currently points to `https://localhost:3000` — replace every `localhost:3000` URL with your production HTTPS host before publishing.
- **Test:** host the files (e.g. `npx http-server -S`), then in Outlook on the web: Settings → Manage add-ins → My add-ins → Add custom add-in → from file → `manifest.xml`.
- **Publish:** submit `manifest.xml` via Partner Center → Marketplace offers → Office add-in (AppSource).

## 4. Microsoft Store (PWA) — `microsoft-store-pwa/`
- Contents: built PWA with `manifest.webmanifest`, service worker, and icons — Store-ready as a PWA.
- **Hosting required:** deploy this folder to any HTTPS static host (Azure Static Web Apps, Netlify, Vercel, GitHub Pages).
- **Package for the Store:** go to https://www.pwabuilder.com, enter the deployed URL, and download the generated **MSIX/Windows package**, then upload it in Partner Center (you already have the BTIM publisher account used for OmniToolkit).

## Rebuild commands (from project root)
```
npm run zip                # Chrome zip → .output/
npx wxt zip -b edge        # Edge zip → .output/
cd apps/pwa && npm run build   # PWA → apps/pwa/dist/
cd apps/outlook-addin && npx esbuild src/taskpane.ts --bundle --minify --outfile=dist/taskpane.js
```
