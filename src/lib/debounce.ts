export function debounce<T extends (...args: any[]) => void>(fn: T, delay = 250): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => fn(...args), delay);
  };
}
