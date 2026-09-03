import { analyzeLocalText } from './localGrammar';
import { generateRewriteVariants } from './rewriteEngine';
import { maskPII } from './piiMasker';
import type { RewriteRequest, TextAnalysisRequest, TextAnalysisResponse, RewriteResponse } from './types';

export function analyzeRequest(request: TextAnalysisRequest): TextAnalysisResponse {
  const trimmed = request.text.trim();
  const issues = trimmed ? analyzeLocalText(trimmed) : [];

  return {
    type: 'TEXT_ANALYSIS_RESPONSE',
    issues,
    confidence: issues.length > 0 ? 0.8 : 0.96,
  };
}

export function rewriteRequest(request: RewriteRequest): RewriteResponse {
  const masked = maskPII(request.text);
  const variants = generateRewriteVariants(masked, request.tone);

  return {
    type: 'REWRITE_RESPONSE',
    variants,
    model: 'local-heuristic',
    status: 'ok',
  };
}
