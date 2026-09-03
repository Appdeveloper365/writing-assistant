
# Writing Assistant Extension Starter

This project is a browser writing assistant extension for Edge, built with WXT + React. It is designed as a privacy-first, local-first writing assistant with a secure rewrite gateway and explicit user approval before replacements are applied.

## Included
- content script that watches editable fields and triggers inline suggestions
- background worker and secure message flow
- popup controls for rewrite mode, tone, preview, and local/cloud behavior
- local grammar heuristics and rewrite pipeline
- remote gateway support for user-managed API subscriptions
- privacy safeguards such as masking and response sanitization

## Rewrite modes

The extension supports three modes:

1. Local AI
   - Runs on the user device
   - No external bill required
   - Best for spelling, grammar hints, lightweight local rewriting

2. Remote AI (user API key)
   - Uses the user’s own OpenAI / Azure / Anthropic / OpenRouter subscription
   - The user pays the AI provider directly
   - Best for stronger paraphrasing and tone-aware rewrite quality

3. Off
   - Disables AI rewrite but keeps local suggestions available when enabled

## Run locally

```bash
npm install
npm run dev
node api-gateway/server.js
npm run build
```

## Provider configuration

The extension can be configured for a provider strategy via environment-driven settings in WXT:

```bash
VITE_PROVIDER=local
VITE_GATEWAY_URL=http://localhost:3001/rewrite
VITE_EXTENSION_API_KEY=demo-local-key
VITE_MODEL=gpt-4o-mini
VITE_REWRITE_ENABLED=true
```

For production deployments, allow the user to provide their own API key or keep the AI mode local-only, rather than requiring the seller to purchase AI access for each user.

## Edge deployment and packaging

Use the packaged build for side-loading or distribution review in Microsoft Edge:

```bash
npm run zip
```

This creates a distributable extension archive for review. For manual testing in Edge:
1. Open `edge://extensions`.
2. Enable Developer mode.
3. Choose `Load unpacked` and point at the generated `.output` folder, or install the generated zip package if your workflow requires it.

## Notes
- Remote rewrite requests are intentionally lightweight and privacy-aware.
- The gateway is a practical backend stub for the production API layer described in the roadmap.
- Rewrite actions require explicit user confirmation before applying text changes.


## Privacy and security

For the product privacy summary, data minimization model, and user-controlled AI policy, see [PRIVACY-SECURITY.md](./PRIVACY-SECURITY.md).


## Multi-shell strategy

- Browser extension shell for Edge/Chrome
- PWA shell for installable web app
- Outlook add-in shell for Microsoft 365 compose scenarios

The core rewrite logic is intentionally shared so the AI model selection and safety rules stay consistent across all surfaces.
