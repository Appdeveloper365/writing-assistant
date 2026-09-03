import { analyzeLocalGrammar } from './localGrammar';
import { maskPII, restoreMaskedPII } from './piiMasker';
import { generateRewriteVariants } from './rewriteEngine';
import type { RewriteRequest, RewriteResponse, TextAnalysisResponse } from './types';

export function buildAnalysisResponse(text: string): TextAnalysisResponse {
  const { issues, confidence } = analyzeLocalGrammar(text);
  return {
    type: 'TEXT_ANALYSIS_RESPONSE',
    issues,
    confidence,
  };
}

export function buildRewriteResponse(request: RewriteRequest): RewriteResponse {
  const masked = maskPII(request.text);
  const variants = generateRewriteVariants(restoreMaskedPII(masked), request.tone);

  return {
    type: 'REWRITE_RESPONSE',
    variants,
    model: 'local-heuristic',
    status: 'ok',
  };
}
