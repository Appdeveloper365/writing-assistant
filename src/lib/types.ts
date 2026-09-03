export type Tone = 'professional' | 'casual' | 'concise' | 'creative';

export interface TextAnalysisIssue {
  id: string;
  start: number;
  end: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestions: string[];
}

export interface TextAnalysisRequest {
  type: 'TEXT_ANALYSIS_REQUEST';
  tabId: number;
  editorId: string;
  text: string;
  context: string;
  timestamp: string;
}

export interface TextAnalysisResponse {
  type: 'TEXT_ANALYSIS_RESPONSE';
  issues: TextAnalysisIssue[];
  confidence: number;
}

export interface RewriteRequest {
  type: 'REWRITE_REQUEST';
  tabId: number;
  editorId: string;
  text: string;
  tone: Tone;
  fidelity: 'strict' | 'balanced';
  length: 'same' | 'shorter' | 'longer';
  cloudEnabled?: boolean;
}

export interface RewriteResponse {
  type: 'REWRITE_RESPONSE';
  variants: string[];
  model: string;
  status: 'ok' | 'rate_limited' | 'error';
}
