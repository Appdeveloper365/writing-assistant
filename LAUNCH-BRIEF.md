# Writing Assistant Extension Launch Brief

## Product positioning
The Writing Assistant is a privacy-first writing aid for Microsoft Edge that helps users fix spelling, improve grammar, and rewrite selected text in a tone-aware and user-controlled way. The product is designed to feel lightweight and useful in real writing workflows without forcing users into broad document rewrites or automatic edits.

## Core product model
- Default mode: Local AI
- Optional mode: Remote AI using the user’s own API key
- Off mode: disables AI rewrite altogether
- Seller does not need to pay for AI access in the base product
- AI rewrite is triggered only when the user explicitly chooses it

## Value proposition
- Local spell check and grammar assistance for free
- Optional stronger paraphrasing when the user chooses remote AI
- User-controlled rewrite preview and accept flow
- Minimal privacy exposure by masking selected text and avoiding raw storage
- Works naturally inside browser-based editing surfaces such as textareas and contenteditable editors

## Supported environment
- Microsoft Edge Chromium
- Browser-based writing apps and editors such as Outlook web, Gmail, Notion, Google Docs, and similar contenteditable systems
- Native desktop Outlook is not a browser extension target and is out of scope for this extension model

## Launch requirements
- Extension package builds cleanly
- Browser smoke tests pass
- Local spell and grammar checks work reliably
- User approval required before rewrite insertion
- Remote AI key flow is optional and user-managed
- Privacy policy and data handling are clear to the user

## Production note
This product is not meant to silently rewrite content. It is a controlled writing helper. That is a strength: it keeps trust high and reduces false-positive risk in real-world writing workflows.
