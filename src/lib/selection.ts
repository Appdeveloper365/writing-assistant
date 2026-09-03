export type Tone = 'professional' | 'casual' | 'concise' | 'creative';

export interface SuggestionAction {
  id: string;
  label: string;
  tone?: Tone;
  kind: 'grammar' | 'rewrite';
}

export interface EditorSelectionState {
  text: string;
  rangeText: string;
  targetId: string;
  anchorOffset: number;
  focusOffset: number;
}

export interface InlineSuggestion {
  id: string;
  message: string;
  suggestions: string[];
  action: SuggestionAction;
}

export function getEditableAncestor(node: Node | null): HTMLElement | null {
  let current = node;

  while (current) {
    if (current instanceof HTMLElement) {
      if (
        current instanceof HTMLInputElement ||
        current instanceof HTMLTextAreaElement ||
        current.isContentEditable
      ) {
        return current;
      }
    }

    current = current.parentNode;
  }

  return null;
}

export function resolveActiveEditableTarget(): HTMLElement | null {
  const active = document.activeElement;
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  ) {
    return active;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const anchorNode = selection.anchorNode;
  if (!anchorNode) return null;

  const anchorTarget = getEditableAncestor(anchorNode);
  if (!anchorTarget) return null;

  return anchorTarget;
}

export function getSelectionState(target: HTMLElement | null): EditorSelectionState | null {
  const editableTarget = target ?? resolveActiveEditableTarget();
  if (!(editableTarget instanceof HTMLElement)) return null;

  if (editableTarget instanceof HTMLInputElement || editableTarget instanceof HTMLTextAreaElement) {
    const start = editableTarget.selectionStart ?? 0;
    const end = editableTarget.selectionEnd ?? 0;
    return {
      text: editableTarget.value,
      rangeText: editableTarget.value.slice(start, end),
      targetId: editableTarget.id || editableTarget.name || 'input',
      anchorOffset: start,
      focusOffset: end,
    };
  }

  if (editableTarget.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const rangeText = selection.toString().trim();
    if (!rangeText) return null;
    return {
      text: editableTarget.textContent ?? '',
      rangeText,
      targetId: editableTarget.id || 'contenteditable',
      anchorOffset: 0,
      focusOffset: 0,
    };
  }

  return null;
}

export function replaceSelectedText(target: HTMLElement, replacement: string): void {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? 0;
    target.focus();
    target.setRangeText(replacement, start, end, 'end');
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  if (target.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const replacementNode = document.createTextNode(replacement);
    range.deleteContents();
    range.insertNode(replacementNode);
    range.setStartAfter(replacementNode);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
    target.focus();
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
