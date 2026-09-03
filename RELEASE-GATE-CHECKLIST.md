# Beta Release Gate Checklist

## Release objective

This checklist defines the final gate before a controlled beta launch of the writing assistant extension for Microsoft Edge.

## Required quality checks

### 1. Functional checks
- [ ] Extension installs successfully in Edge with developer mode
- [ ] Popup opens and the Local AI / Remote AI / Off mode selector behaves correctly
- [ ] Remote AI mode shows a clear requirement for a user-owned API key
- [ ] Local AI mode works without external services
- [ ] Rewrite preview appears before applying a replacement
- [ ] Accept / reject actions work cleanly for selected text
- [ ] App does not silently rewrite text without user confirmation

### 2. Editor compatibility checks
- [ ] Works in Outlook web compose flows
- [ ] Works in Gmail compose and reply flows
- [ ] Works in Google Docs editing canvas
- [ ] Works in Notion edit surfaces
- [ ] Handles contenteditable rerender and selection drift gracefully
- [ ] Works in basic textarea and input fields

### 3. Privacy and security checks
- [ ] Remote AI only triggers when the user enables it
- [ ] API key is only stored in browser local storage
- [ ] Request payloads are minimal and selection-scoped
- [ ] PII masking is applied before outbound requests
- [ ] External calls use HTTPS and request validation
- [ ] Remote AI billing is clearly explained to users

### 4. Packaging and submission checks
- [ ] Build passes without errors
- [ ] Zip package is generated successfully
- [ ] Manifest and metadata are present and valid
- [ ] Listing copy and screenshots are ready
- [ ] Privacy disclosures and billing model are clear in the store listing

### 5. Operational readiness checks
- [ ] Known limitations are documented for unsupported editors
- [ ] Feedback collection path is ready
- [ ] Rollback path is documented for a failing beta release
- [ ] Support contact or issue reporting route is available

## Beta release decision

Approve the beta only if all critical items are complete and no unresolved blocking issue remains in the supported editor set.

## Known limitations

- Native Outlook desktop is not a browser extension target
- Some dynamic editors may require selection recovery or fallback behavior
- Remote AI depends on the user’s own subscription and provider key
- Local grammar support remains rule- and heuristic-based compared to advanced ML models
