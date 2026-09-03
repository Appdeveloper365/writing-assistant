export interface EditorSnapshot {
  targetId: string;
  kind: 'input' | 'textarea' | 'contenteditable';
  text: string;
  selectedText: string;
  timestamp: number;
}

export function captureEditorSnapshot(target: HTMLElement): EditorSnapshot | null {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    return {
      targetId: target.id || 'input',
      kind: target instanceof HTMLTextAreaElement ? 'textarea' : 'input',
      text: target.value,
      selectedText: target.value.slice(start, end),
      timestamp: Date.now(),
    };
  }

  if (target.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const selectedText = selection.toString().trim();
    if (!selectedText) return null;
    return {
      targetId: target.id || 'contenteditable',
      kind: 'contenteditable',
      text: target.textContent ?? '',
      selectedText,
      timestamp: Date.now(),
    };
  }

  return null;
}
