const emailPattern = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
const phonePattern = /(\+?\d[\d\s().-]{7,}\d)/g;
const addressPattern = /\b\d+\s+[A-Za-z0-9 .'-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr)\b/gi;

export function maskPII(input: string): string {
  let output = input;
  output = output.replace(emailPattern, '[EMAIL]');
  output = output.replace(phonePattern, '[PHONE]');
  output = output.replace(addressPattern, '[ADDRESS]');
  return output;
}

export function restoreMaskedPII(input: string): string {
  return input
    .replace(/\[EMAIL\]/g, 'user@example.com')
    .replace(/\[PHONE\]/g, '+1 (555) 123-4567')
    .replace(/\[ADDRESS\]/g, '123 Example St');
}
