import type { Tone } from './types';

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function generateRewriteVariants(text: string, tone: Tone): string[] {
  const safeText = normalizeText(text);
  if (!safeText) return [''];

  const base = safeText.charAt(0).toUpperCase() + safeText.slice(1);

  const professional = base
    .replace(/\bplease\b/gi, 'kindly')
    .replace(/\bI think\b/gi, 'I believe')
    .replace(/\bvery\b/gi, '')
    .replace(/\bpretty\b/gi, 'quite')
    .replace(/\bgot\b/gi, 'obtained');

  const casual = base
    .replace(/\bkindly\b/gi, 'please')
    .replace(/\bI believe\b/gi, 'I think')
    .replace(/\bobtained\b/gi, 'got')
    .replace(/\bquite\b/gi, 'pretty');

  const concise = base
    .replace(/\bkindly\b/gi, 'please')
    .replace(/\bI believe\b/gi, 'I think')
    .replace(/\s+that\b/gi, '');

  const creative = `${base} With a touch of clarity and energy, this message feels more engaging and memorable.`;

  const variants: Record<Tone, string> = {
    professional,
    casual,
    concise: concise.length > 120 ? concise.slice(0, 120).trim() + '…' : concise,
    creative,
  };

  const ordered = [variants[tone], variants.professional, variants.casual];
  const unique = Array.from(new Set(ordered.filter(Boolean)));
  return unique.slice(0, 3);
}
