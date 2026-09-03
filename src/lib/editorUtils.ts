export function isEditableTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

export function getEditableText(target: HTMLElement): string {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value;
  }
  if (target.isContentEditable) {
    return target.textContent ?? '';
  }
  return '';
}

export function getSelectionText(): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return '';
  return selection.toString().trim();
}

export function createRangeSnapshot(target: HTMLElement) {
  const selection = window.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  return {
    target,
    text: getEditableText(target),
    selectedText: range ? range.toString().trim() : '',
    rect: target.getBoundingClientRect(),
  };
}
