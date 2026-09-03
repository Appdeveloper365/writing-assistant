export default defineBackground(() => {
  console.log('Smart Paraphraser background worker started');

  browser.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
    const message = rawMessage as { type?: string };
    if (message.type === 'TEXT_ANALYSIS_REQUEST') {
      sendResponse({
        type: 'TEXT_ANALYSIS_RESPONSE',
        issues: [
          {
            id: 'issue-1',
            start: 0,
            end: 5,
            severity: 'medium',
            message: 'Possible wording improvement',
            suggestions: ['Improve wording', 'Refine this sentence'],
          },
        ],
        confidence: 0.82,
      });
    }

    if (message.type === 'REWRITE_REQUEST') {
      sendResponse({
        type: 'REWRITE_RESPONSE',
        variants: [
          'This message can be refined for a more professional tone.',
          'This message reads more clearly in a professional style.',
        ],
        model: 'gpt-4o-mini',
        status: 'ok',
      });
    }

    return true;
  });
});
