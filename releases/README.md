# Smart Paraphraser — Release Packages (v0.1.0)

Built 2026-09-02 from `C:\Users\bala\writing-assistant`. Typecheck clean, 7/7 tests passing.

Hosting for the Outlook add-in and the Store PWA is **GitHub Pages** from this repo's `docs/` folder:
**https://appdeveloper365.github.io/writing-assistant/** (PWA at root, Outlook taskpane at `/outlook/taskpane.html`).

## 1. Chrome — `smart-paraphraser-0.1.0-chrome.zip`
- **Publish:** upload at https://chrome.google.com/webstore/devconsole (one-time $5 fee). Needs: screenshots and a privacy policy URL (see `../PRIVACY-SECURITY.md`). Icons are included in the package.
- **Test locally:** `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3/`.

## 2. Edge — `smart-paraphraser-0.1.0-edge.zip`
- **Publish:** upload at https://partner.microsoft.com/dashboard/microsoftedge (free, use the existing BTIM account).
- **Test locally:** `edge://extensions` → Developer mode → Load unpacked.

## 3. Outlook add-in — `outlook-addin/` (`smart-paraphraser-0.1.0-outlook-addin.zip`)
- **The publishable file is `manifest.xml`** — it points at the live GitHub Pages URLs, so it works today.
- Features: grammar/spell check of the message body, tone-based rewrite suggestions with one-click insert into the composer (Office.js).
- **Test:** Outlook on the web → Settings → Manage add-ins → My add-ins → Add custom add-in → From file → `manifest.xml`.
- **Publish:** Partner Center → Marketplace offers → Office add-in (AppSource) → upload `manifest.xml`.

## 4. Microsoft Store (PWA → MSIX) — `microsoft-store-pwa/`
- This folder mirrors the live site (`docs/` on GitHub Pages).
- **Get the MSIX:** at https://www.pwabuilder.com enter
  `https://appdeveloper365.github.io/writing-assistant/`, click **Package for Stores → Windows**,
  fill in the Package ID / Publisher ID from Partner Center → Product identity, and download the `.msixbundle`.
- **Publish:** upload the `.msixbundle` in Partner Center as a new app submission.

## Branding
- Logo source: `../assets-src/logo.html` (SVG, pen writing on a notepad). All PNG sizes in `../assets-src/`.

## Rebuild commands (from project root)
```
npm run zip                    # Chrome zip → .output/
npx wxt zip -b edge            # Edge zip → .output/
cd apps/pwa && npm run build   # PWA → apps/pwa/dist/
cd apps/outlook-addin && npx esbuild src/taskpane.ts --bundle --minify --outfile=dist/taskpane.js
```
