import type { TextAnalysisIssue } from './types';

const commonMistakes: Record<string, string> = {
  teh: 'the',
  recieve: 'receive',
  seperat: 'separate',
  definately: 'definitely',
  occured: 'occurred',
  embarass: 'embarrass',
  goverment: 'government',
  enviroment: 'environment',
  mangement: 'management',
  im: "I'm",
  dont: "don't",
  cant: "can't",
  wont: "won't",
  youre: "you're",
  its: "it's",
  their: "they're",
  there: "their",
  then: 'than',
  than: 'then',
  affect: 'effect',
  effect: 'affect',
  loose: 'lose',
  lose: 'loose',
  alot: 'a lot',
  alomst: 'almost',
  reccomend: 'recommend',
  commited: 'committed',
  persistance: 'persistence',
};

const repeatedPunctuation = /[!?]{2,}/g;
const repeatedWhitespace = /\s{2,}/g;
const sentenceStartsWithLowercase = /(^|[.!?]\s+)([a-z])/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createIssue(
  key: string,
  start: number,
  end: number,
  severity: 'low' | 'medium' | 'high',
  message: string,
  suggestions: string[],
): TextAnalysisIssue {
  return { id: `local-${key}`, start, end, severity, message, suggestions };
}

export function analyzeLocalText(text: string): TextAnalysisIssue[] {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return [];

  const issues = new Map<string, TextAnalysisIssue>();
  const lower = trimmed.toLowerCase();

  for (const [wrong, fixed] of Object.entries(commonMistakes)) {
    const pattern = new RegExp(`\\b${escapeRegExp(wrong)}\\b`, 'gi');
    const match = lower.match(pattern);
    if (!match) continue;

    const location = lower.search(pattern);
    if (location < 0) continue;

    const issue = createIssue(
      `${wrong}-${fixed}`,
      location,
      location + wrong.length,
      wrong.length > 6 ? 'medium' : 'low',
      `Possible wording improvement: “${wrong}” → “${fixed}”`,
      [fixed],
    );
    issues.set(issue.id, issue);
  }

  const repeatedWhitespaceMatch = repeatedWhitespace.test(trimmed);
  if (repeatedWhitespaceMatch) {
    issues.set('local-double-space', createIssue(
      'double-space',
      0,
      trimmed.length,
      'low',
      'Multiple spaces detected.',
      ['Use a single space between words.'],
    ));
  }

  const repeatedPunctuationMatch = repeatedPunctuation.test(trimmed);
  if (repeatedPunctuationMatch) {
    issues.set('local-punctuation', createIssue(
      'punctuation',
      0,
      trimmed.length,
      'low',
      'Repeated punctuation may be too abrupt.',
      ['Use a single punctuation mark.'],
    ));
  }

  const lowercaseSentenceMatch = sentenceStartsWithLowercase.test(trimmed);
  if (lowercaseSentenceMatch) {
    const nextIssue = createIssue(
      'sentence-case',
      0,
      trimmed.length,
      'low',
      'Some sentences may need initial capitalization.',
      ['Capitalize the first word of a sentence.'],
    );
    issues.set(nextIssue.id, nextIssue);
  }

  const sorted = Array.from(issues.values()).sort((a, b) => a.start - b.start);
  return sorted.slice(0, 5);
}

export function analyzeLocalGrammar(text: string): { issues: TextAnalysisIssue[]; confidence: number } {
  const issues = analyzeLocalText(text);
  const normalized = text.replace(/\s+/g, ' ').trim();
  const densityPenalty = issues.length * 0.08;
  const lengthBoost = normalized.length > 80 ? 0.06 : 0.02;
  const confidence = clamp(0.98 - densityPenalty + lengthBoost, 0.52, 0.99);

  return { issues, confidence };
}
