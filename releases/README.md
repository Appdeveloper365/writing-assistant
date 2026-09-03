# Writing Assistant — Release Packages (v0.1.0)

Built 2026-09-02 from `C:\Users\bala\writing-assistant`. All builds typecheck clean and pass the 7 unit tests.

Hosting for the Outlook add-in and the Store PWA is set up via **GitHub Pages** from this repo's `docs/` folder:
**https://appdeveloper365.github.io/writing-assistant/** (PWA at root, Outlook taskpane at `/outlook/taskpane.html`).

## 1. Chrome — `writing-assistant-0.1.0-chrome.zip`
- **Publish:** upload at https://chrome.google.com/webstore/devconsole (one-time $5 fee). Needs: 128px icon, screenshots, privacy policy URL (see `../PRIVACY-SECURITY.md`).
- **Test locally:** `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3/`.

## 2. Edge — `writing-assistant-0.1.0-edge.zip`
- **Publish:** upload at https://partner.microsoft.com/dashboard/microsoftedge (free, use the existing BTIM account).
- **Test locally:** `edge://extensions` → Developer mode → Load unpacked.

## 3. Outlook add-in — `outlook-addin/writing-assistant-0.1.0-outlook-addin.zip`
- **The publishable file is `manifest.xml`** — it points at the GitHub Pages URLs above, so it works as soon as the repo is on GitHub with Pages enabled (Settings → Pages → Deploy from branch → `main` / `docs`).
- Features: grammar/spell check of the message body, tone-based rewrite suggestions with one-click insert into the composer (real Office.js integration).
- **Test:** Outlook on the web → Settings → Manage add-ins → My add-ins → Add custom add-in → From file → `manifest.xml`.
- **Publish:** Partner Center → Marketplace offers → Office add-in (AppSource) → upload `manifest.xml`.

## 4. Microsoft Store (PWA → MSIX) — `microsoft-store-pwa/`
- This folder is the deployed site content (already in `docs/`, served by GitHub Pages).
- **Get the MSIX:** once Pages is live, go to https://www.pwabuilder.com, enter
  `https://appdeveloper365.github.io/writing-assistant/`, click **Package for Stores → Windows**,
  fill in your Partner Center identity values (Package ID, Publisher ID from Partner Center →
  Product identity — same place you got the OmniToolkit values), and download the `.msixbundle`.
- **Publish:** upload that `.msixbundle` in Partner Center as a new MSIX/PWA app submission.

## Rebuild commands (from project root)
```
npm run zip                    # Chrome zip → .output/
npx wxt zip -b edge            # Edge zip → .output/
cd apps/pwa && npm run build   # PWA → apps/pwa/dist/
cd apps/outlook-addin && npx esbuild src/taskpane.ts --bundle --minify --outfile=dist/taskpane.js
```
