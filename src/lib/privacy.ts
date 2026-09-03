export function redactSensitiveText(value: string): string {
  return value
    .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '[EMAIL]')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[PHONE]')
    .replace(/\b\d+\s+[A-Za-z0-9 .'-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr)\b/gi, '[ADDRESS]');
}

export function sanitizeResponse(value: string): string {
  return value.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();
}
