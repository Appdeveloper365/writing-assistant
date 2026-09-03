import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocalGrammar, analyzeLocalText } from '../src/lib/localGrammar.ts';

test('analyzeLocalText catches common mistakes', () => {
  const result = analyzeLocalText('teh quick brown fox recieve the email.');
  assert.ok(result.some((issue) => issue.message.includes('teh')));
  assert.ok(result.some((issue) => issue.message.includes('recieve')));
});

test('analyzeLocalGrammar lowers confidence for noisy text', () => {
  const noisy = analyzeLocalGrammar('teh quick fox dont know whos there');
  const clean = analyzeLocalGrammar('The quick brown fox does not know who is there.');

  assert.ok(noisy.confidence < clean.confidence);
  assert.ok(noisy.confidence > 0.5);
  assert.ok(clean.confidence > 0.9);
});

test('repeated punctuation and whitespace are flagged', () => {
  const issues = analyzeLocalText('This  is a test!!');
  assert.ok(issues.some((issue) => issue.id.includes('double-space') || issue.id.includes('punctuation')));
});
