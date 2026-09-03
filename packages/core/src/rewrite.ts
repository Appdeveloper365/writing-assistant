import { maskSensitiveData } from './privacy';
import type { RewriteRequest, RewriteResult } from './types';

export function buildLocalRewriteResult(request: RewriteRequest): RewriteResult {
  const safeText = maskSensitiveData(request.text || 'Your draft');
  const variants = [
    `${safeText} in a ${request.tone} tone reads more clearly and professionally.`,
    `${safeText} is more concise and direct while preserving meaning.`,
    `${safeText} feels more natural and engaging for a ${request.tone} voice.`,
  ];
  return { variants, model: 'local-ai', status: 'ok' };
}

export function buildRewriteRequest(text: string, tone: RewriteRequest['tone']): RewriteRequest {
  return { text, tone, mode: 'local' };
}
