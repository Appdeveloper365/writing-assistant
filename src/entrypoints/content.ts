export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main: () => {
    const onInput = () => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return;

      const text = active.textContent ?? (active as HTMLTextAreaElement).value ?? '';
      const payload = {
        type: 'TEXT_ANALYSIS_REQUEST',
        tabId: 0,
        editorId: active.id || 'anonymous-editor',
        text,
        context: 'writing',
        timestamp: new Date().toISOString(),
      };

      browser.runtime.sendMessage(payload).then((response) => {
        if (!response) return;
        console.log('Analysis response:', response);
      });
    };

    document.addEventListener('input', onInput, true);
    document.addEventListener('keyup', onInput, true);
  },
});
