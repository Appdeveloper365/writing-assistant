# Release Memo

## Summary
The Writing Assistant extension is ready for Edge release as a privacy-first browser writing tool. It provides local spell/grammar support, optional user-owned AI rewrite, and a controlled approval flow before the user’s text is changed.

## Product stance
- Local AI is the default and free
- Remote AI is optional and user-paid via their own API key
- The seller does not need to purchase AI access for the base extension
- The product is built for trust, not silent automation

## Risk areas
- Complex contenteditable editors can behave differently across web apps
- Inline insertion should stay conservative and user-confirmed
- Remote AI fallback must be controlled and privacy-safe

## Launch recommendation
Proceed with internal beta validation, then a limited Edge release. Validate Outlook web and other high-traffic editors before broader rollout.
