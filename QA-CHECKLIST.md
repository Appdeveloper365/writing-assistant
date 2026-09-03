# Outlook and Web Editor QA Checklist

## Functional checks
- [ ] Toolbar appears when selecting text in a textarea
- [ ] Toolbar appears when selecting text in contenteditable areas
- [ ] Apply action updates the correct field only
- [ ] Reject action closes preview without modifying text
- [ ] Preview shows before replacement when confirmation is enabled
- [ ] Local mode works without any API key
- [ ] Remote mode requires a valid API key
- [ ] Off mode disables AI rewrite

## Editor checks
- [ ] Outlook web compose
- [ ] Gmail compose
- [ ] Google Docs
- [ ] Notion
- [ ] Word online
- [ ] Plain text input fields

## Edge checks
- [ ] Extension loads in Edge with dev mode
- [ ] Chrome MV3 packaging works
- [ ] Popup settings persist across reloads
- [ ] Extension works after restart

## Security checks
- [ ] API calls are only made for explicit rewrite requests
- [ ] PII is masked before outbound calls
- [ ] No raw text is stored long-term
- [ ] No modifications are applied without user approval
