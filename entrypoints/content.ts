import { captureEditorSnapshot } from '../src/lib/editorSnapshot';
import { replaceSelectedText, resolveActiveEditableTarget } from '../src/lib/selection';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main: () => {
    const hideToolbar = () => {
      const existing = document.querySelector('.wa-editor-toolbar');
      if (existing) existing.remove();
    };

    const hidePreview = () => {
      const existing = document.querySelector('.wa-rewrite-preview');
      if (existing) existing.remove();
    };

    const getToolbarTarget = (): HTMLElement | null => {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return active;
      }

      return resolveActiveEditableTarget();
    };

    const applySuggestion = (target: HTMLElement, replacement: string) => {
      replaceSelectedText(target, replacement);
      hidePreview();
    };

    const showPreview = (target: HTMLElement, selectedText: string, variants: string[]) => {
      hidePreview();
      const rect = target.getBoundingClientRect();
      const wrapper = document.createElement('div');
      wrapper.className = 'wa-rewrite-preview';
      wrapper.style.position = 'fixed';
      wrapper.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - 150, 12), window.innerWidth - 320)}px`;
      wrapper.style.top = `${Math.max(rect.top - 120, 12)}px`;
      wrapper.style.zIndex = '2147483647';
      wrapper.style.width = '300px';
      wrapper.style.background = '#111827';
      wrapper.style.color = '#fff';
      wrapper.style.padding = '12px';
      wrapper.style.borderRadius = '12px';
      wrapper.style.boxShadow = '0 12px 32px rgba(15, 23, 42, 0.28)';
      wrapper.style.fontSize = '12px';
      wrapper.style.lineHeight = '1.5';

      const first = variants[0] || selectedText;
      const heading = document.createElement('div');
      heading.textContent = 'Rewrite preview';
      heading.style.fontWeight = '600';
      heading.style.marginBottom = '8px';

      const previewText = document.createElement('div');
      previewText.textContent = first;
      previewText.style.marginBottom = '10px';
      previewText.style.padding = '8px';
      previewText.style.background = 'rgba(255, 255, 255, 0.06)';
      previewText.style.borderRadius = '8px';

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.justifyContent = 'flex-end';

      const rejectButton = document.createElement('button');
      rejectButton.type = 'button';
      rejectButton.textContent = 'Reject';
      rejectButton.style.padding = '6px 10px';
      rejectButton.style.borderRadius = '8px';
      rejectButton.style.border = 'none';
      rejectButton.style.cursor = 'pointer';
      rejectButton.addEventListener('click', () => hidePreview());

      const acceptButton = document.createElement('button');
      acceptButton.type = 'button';
      acceptButton.textContent = 'Apply';
      acceptButton.style.padding = '6px 10px';
      acceptButton.style.borderRadius = '8px';
      acceptButton.style.border = 'none';
      acceptButton.style.background = '#2563eb';
      acceptButton.style.color = '#fff';
      acceptButton.style.cursor = 'pointer';
      acceptButton.addEventListener('click', () => applySuggestion(target, first));

      actions.appendChild(rejectButton);
      actions.appendChild(acceptButton);
      wrapper.appendChild(heading);
      wrapper.appendChild(previewText);
      wrapper.appendChild(actions);
      document.body.appendChild(wrapper);
    };

    const renderToolbar = async (target: HTMLElement, selectedText: string) => {
      hideToolbar();
      const settings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
      const requireConfirmation = settings?.requireConfirmation ?? true;
      const showPreview = settings?.showPreview ?? true;

      const rect = target.getBoundingClientRect();
      const left = Math.min(Math.max(rect.left + rect.width / 2, 18), window.innerWidth - 220);
      const top = Math.max(rect.top - 62, 12);

      const toolbar = document.createElement('div');
      toolbar.className = 'wa-editor-toolbar';
      toolbar.style.position = 'fixed';
      toolbar.style.left = `${left}px`;
      toolbar.style.top = `${top}px`;
      toolbar.style.zIndex = '2147483647';
      toolbar.style.background = 'linear-gradient(180deg, #111827 0%, #1f2937 100%)';
      toolbar.style.color = '#fff';
      toolbar.style.padding = '8px';
      toolbar.style.borderRadius = '12px';
      toolbar.style.display = 'flex';
      toolbar.style.gap = '8px';
      toolbar.style.boxShadow = '0 10px 24px rgba(15, 23, 42, 0.24)';
      toolbar.style.fontSize = '12px';
      toolbar.style.fontWeight = '600';
      toolbar.style.border = '1px solid rgba(148, 163, 184, 0.25)';
      toolbar.innerHTML = `
        <button type="button" data-tone="professional" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: white; border-radius: 8px; padding: 6px 10px; cursor: pointer;">Professional</button>
        <button type="button" data-tone="concise" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: white; border-radius: 8px; padding: 6px 10px; cursor: pointer;">Concise</button>
        <button type="button" data-tone="creative" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color: white; border-radius: 8px; padding: 6px 10px; cursor: pointer;">Creative</button>
      `;

      toolbar.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', async () => {
          const tone = button.getAttribute('data-tone') as 'professional' | 'concise' | 'creative';
          const response = await browser.runtime.sendMessage({
            type: 'REWRITE_REQUEST',
            tabId: 0,
            editorId: target.id || 'editor',
            text: selectedText,
            tone,
            fidelity: 'balanced',
            length: 'same',
            cloudEnabled: false,
          });

          const variants = response?.variants ?? [selectedText];
          hideToolbar();

          if (requireConfirmation && showPreview) {
            showPreview(target, selectedText, variants);
            return;
          }

          applySuggestion(target, variants[0] || selectedText);
        });
      });

      document.body.appendChild(toolbar);
    };

    let pendingToolbarSync: number | null = null;

    const scheduleToolbarSync = () => {
      if (pendingToolbarSync !== null) {
        cancelAnimationFrame(pendingToolbarSync);
      }

      pendingToolbarSync = requestAnimationFrame(() => {
        pendingToolbarSync = null;
        const target = getToolbarTarget();
        if (!target) {
          hideToolbar();
          hidePreview();
          return;
        }

        const snapshot = captureEditorSnapshot(target);
        if (!snapshot || !snapshot.selectedText) {
          hideToolbar();
          hidePreview();
          return;
        }

        renderToolbar(target, snapshot.selectedText);
      });
    };

    const syncToolbarForSelection = () => {
      scheduleToolbarSync();
    };

    document.addEventListener('mouseup', syncToolbarForSelection, true);
    document.addEventListener('keyup', syncToolbarForSelection, true);
    document.addEventListener('selectionchange', syncToolbarForSelection, true);
    document.addEventListener('focusin', syncToolbarForSelection, true);
    document.addEventListener('input', syncToolbarForSelection, true);

    const mutationObserver = new MutationObserver(() => {
      const activeTarget = getToolbarTarget();
      if (!activeTarget) {
        hideToolbar();
        hidePreview();
        return;
      }

      if (activeTarget.closest('.wa-editor-toolbar') || activeTarget.closest('.wa-rewrite-preview')) {
        return;
      }

      scheduleToolbarSync();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    document.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      if (!target || target.closest('.wa-editor-toolbar') || target.closest('.wa-rewrite-preview')) return;
      hideToolbar();
      hidePreview();
    }, true);
  },
});
