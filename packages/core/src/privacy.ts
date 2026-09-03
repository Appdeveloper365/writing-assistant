export function maskSensitiveData(text: string): string {
  return String(text)
    .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '[EMAIL]')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[PHONE]')
    .replace(/\d{3}-\d{2}-\d{4}/g, '[SSN]')
    .trim();
}
