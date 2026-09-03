# Privacy and Security Policy

## Product summary

This writing assistant is designed as a privacy-first browser extension for Microsoft Edge. It provides local spell and grammar assistance by default and supports optional AI rewrite when the user explicitly enables and configures it.

The product is built around a clear principle: the user decides whether to use local AI, remote AI with their own API key, or no AI at all. The extension does not silently rewrite text or force a paid AI plan for the end user.

## Data handling model

### Local processing by default

The default grammar and spelling checks run entirely on the user device. Text stays in the browser and is not sent to the seller or a remote service unless the user chooses a remote AI flow.

### Remote AI when explicitly enabled

When the user selects Remote AI mode, the extension uses the user-provided API key to contact the selected provider. This is an explicit action taken by the user and is billed to the user directly according to that provider's pricing.

The extension does not include a seller-funded AI subscription. AI usage is controlled by settings in the popup and is not automatic.

### Minimal request scope

Remote requests are intentionally limited to the smallest useful payload. That includes:
- selected text only
- tone and rewrite parameters
- provider metadata
- request context required for the rewrite

The extension avoids sending an entire document unless the user intentionally selects or pastes it into a rewrite request. The default design is on-selection and preview-first behavior.

## PII masking and data minimization

Before any outbound request to an external provider, the extension applies masking to common personal data patterns, including:
- email addresses
- phone numbers
- credit card numbers
- common government ID patterns
- addresses and ZIP-like sequences where feasible

This masking is designed to reduce the chance that personal data is transmitted in raw form. The implementation is intentionally conservative and designed for a privacy-first product model.

## Explicit user consent

The extension requires a user action before content is rewritten. The workflow is:
1. select text in a supported editor
2. choose a tone or rewrite action
3. review a preview if enabled
4. accept or reject the result

The user always remains in control. No text is silently replaced without this review step.

## Retention and storage

The seller should not maintain long-term storage of user-generated text by default.

Recommended default policies:
- store user settings locally only
- do not persist raw rewrite payloads in seller-controlled databases
- retain API keys only in browser local storage and never in the extension package or public source control
- keep gateway logs limited to request metadata, request IDs, and failure diagnostics
- avoid storing the original unmasked content in logs or analytics systems

Any logs retained for diagnostics should be short-lived and contain minimal data only when necessary for debugging.

## Security controls

The extension and gateway should enforce the following controls:
- API key validation before remote rewrite requests
- request size limits to prevent abuse
- rate limiting to reduce misuse or accidental high-volume requests
- secure transport to provider endpoints using HTTPS
- response sanitization before showing results in the UI
- clear fallback to local rewrite behavior if remote AI fails

## User-facing trust message

Users should be told clearly that:
- local AI is built in and no subscription is required
- remote AI is optional and user-controlled
- the user pays the AI provider directly if they choose remote AI
- the seller does not force a paid AI plan into the product
- rewrite actions are previewed before apply
- the extension minimizes data exposure by default

## Compliance note

This document is a product-level policy statement for transparency and secure product design. It is not a substitute for legal review or a formal privacy policy used for app-store compliance. Final public-facing legal wording should be reviewed by counsel before publication.
