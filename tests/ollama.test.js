import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cosineSimilarity, ensureModelReady, getOllamaSettings, getOllamaStatus, isModelCached } from '../api-gateway/ollama.js';
import { SemanticCache, textSimilarity } from '../api-gateway/semanticCache.js';

test('default engine uses gemma2:2b with no embedding model', () => {
  const settings = getOllamaSettings();
  assert.equal(settings.generateModel, 'gemma2:2b');
  assert.equal(settings.embedModel, '');
});

test('cosineSimilarity scores identical, orthogonal and invalid vectors', () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosineSimilarity([1, 1], [1, 0]) - Math.SQRT1_2) < 1e-9);
  assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0);
  assert.equal(cosineSimilarity(null, [1]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
});

test('isModelCached matches installed models with and without tags', () => {
  const installed = ['paraphrase-multilingual:278m', 'qwen2.5:3b'];
  assert.equal(isModelCached(installed, 'paraphrase-multilingual:278m'), true);
  assert.equal(isModelCached(installed, 'Paraphrase-Multilingual:278M'), true);
  assert.equal(isModelCached(installed, 'paraphrase-multilingual:110m'), false);
  assert.equal(isModelCached(installed, 'paraphrase-multilingual'), true);
  assert.equal(isModelCached(installed, 'llama3.2'), false);
  assert.equal(isModelCached([], 'paraphrase-multilingual:278m'), false);
});

test('gateway tracker aggregates pull progress like the extension tracker', async () => {
  const module = await import('../api-gateway/ollama.js');
  const tracker = module.createPullTracker();

  assert.equal(tracker.onLine(''), null);
  assert.equal(tracker.onLine('not-json'), null);

  const first = tracker.onLine(JSON.stringify({ status: 'downloading', digest: 'sha256:aaa', total: 2000, completed: 500 }));
  assert.equal(first.percent, 25);

  const second = tracker.onLine(JSON.stringify({ status: 'downloading', digest: 'sha256:bbb', total: 1000, completed: 1000 }));
  assert.equal(second.percent, 50);

  const success = tracker.onLine(JSON.stringify({ status: 'success' }));
  assert.equal(success.done, true);
  assert.equal(success.percent, 100);
  assert.equal(tracker.isDone(), true);
});

test('getOllamaStatus degrades gracefully when Ollama is unreachable', async () => {
  const status = await getOllamaStatus({
    host: 'http://127.0.0.1:9',
    timeoutMs: 500,
    model: 'gemma2:2b',
  });
  assert.equal(status.available, false);
  assert.equal(status.modelCached, false);
  assert.equal(status.model, 'gemma2:2b');
});

test('ensureModelReady reports unavailable Ollama without throwing', async () => {
  const result = await ensureModelReady({ host: 'http://127.0.0.1:9' });
  assert.equal(result.ready, false);
  assert.equal(result.available, false);
  assert.equal(result.reason, 'ollama-unavailable');
  assert.equal(result.generateModel, 'gemma2:2b');
});

test('textSimilarity scores identical, reworded and unrelated text', () => {
  assert.equal(textSimilarity('Hello world', 'hello   world'), 1);
  assert.equal(textSimilarity('the quick brown fox', 'unrelated text'), 0);

  const near = textSimilarity(
    'we should totally grab coffee sometime next week if you are free',
    'we should totally grab coffee sometime next week when you are free',
  );
  assert.ok(near >= 0.85, `expected >= 0.85, got ${near}`);
});

test('SemanticCache answers near-identical rewordings without embeddings (fuzzy)', () => {
  const cache = new SemanticCache({ persistPath: null });
  cache.store({
    text: 'we should totally grab coffee sometime next week if you are free',
    tone: 'professional',
    fidelity: 'balanced',
    length: 'same',
    variants: ['Cached rewrite'],
    model: 'gemma2:2b',
  });

  const hit = cache.lookup({
    text: 'we should totally grab coffee sometime next week when you are free',
    tone: 'professional',
    fidelity: 'balanced',
    length: 'same',
  });
  assert.ok(hit);
  assert.equal(hit.kind, 'fuzzy');
  assert.ok(hit.similarity >= 0.85);
  assert.deepEqual(hit.variants, ['Cached rewrite']);
  assert.ok(cache.snapshot().fuzzyHits >= 1);
});

test('SemanticCache answers exact matches without embeddings', () => {
  const cache = new SemanticCache({ persistPath: null });
  const stored = cache.store({
    text: 'Hello   world',
    tone: 'professional',
    fidelity: 'balanced',
    length: 'same',
    variants: ['Variant A'],
    model: 'local-gateway-stub',
  });
  assert.equal(stored, true);

  const hit = cache.lookup({ text: 'hello world', tone: 'professional', fidelity: 'balanced', length: 'same' });
  assert.ok(hit);
  assert.equal(hit.kind, 'exact');
  assert.equal(hit.similarity, 1);
  assert.equal(hit.model, 'local-gateway-stub');
  assert.deepEqual(hit.variants, ['Variant A']);

  const toneMiss = cache.lookup({ text: 'hello world', tone: 'casual', fidelity: 'balanced', length: 'same' });
  assert.equal(toneMiss, null);
});

test('SemanticCache answers semantically similar rewordings above threshold', () => {
  const cache = new SemanticCache({ threshold: 0.9, persistPath: null });
  cache.store({
    text: 'the quick brown fox',
    tone: 'professional',
    fidelity: 'balanced',
    length: 'same',
    embedding: [1, 0, 0],
    variants: ['Rewritten fox'],
    model: 'stub',
  });

  const semanticHit = cache.lookup({
    text: 'a differently worded request',
    tone: 'professional',
    fidelity: 'balanced',
    length: 'same',
    embedding: [0.99, 0.1, 0],
  });
  assert.ok(semanticHit);
  assert.equal(semanticHit.kind, 'semantic');
  assert.ok(semanticHit.similarity >= 0.9);
  assert.deepEqual(semanticHit.variants, ['Rewritten fox']);

  const miss = cache.lookup({
    text: 'unrelated text',
    tone: 'professional',
    fidelity: 'balanced',
    length: 'same',
    embedding: [0, 1, 0],
  });
  assert.equal(miss, null);

  const snapshot = cache.snapshot();
  assert.ok(snapshot.semanticHits >= 1);
  assert.ok(snapshot.misses >= 1);
});

test('SemanticCache evicts the oldest entries beyond the cap', () => {
  const cache = new SemanticCache({ maxEntries: 2, persistPath: null });
  cache.store({ text: 'first', variants: ['v1'], tone: 'professional' });
  cache.store({ text: 'second', variants: ['v2'], tone: 'professional' });
  cache.store({ text: 'third', variants: ['v3'], tone: 'professional' });

  assert.equal(cache.size, 2);
  assert.equal(cache.lookup({ text: 'first', tone: 'professional' }), null);
  assert.ok(cache.lookup({ text: 'third', tone: 'professional' }));
});

test('SemanticCache rejects empty results and persists entries to disk', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'wa-semantic-cache-'));
  const persistPath = path.join(dir, 'cache.json');

  try {
    const cache = new SemanticCache({ persistPath });
    assert.equal(cache.store({ text: 'no variants', variants: [], tone: 'professional' }), false);

    cache.store({
      text: 'persisted request',
      tone: 'casual',
      fidelity: 'balanced',
      length: 'same',
      embedding: [0.5, 0.5],
      variants: ['cached variant'],
      model: 'local-gateway-stub',
    });
    assert.equal(cache.save(), true);

    const restored = new SemanticCache({ persistPath });
    assert.equal(restored.load(), 1);

    const hit = restored.lookup({ text: 'persisted request', tone: 'casual', fidelity: 'balanced', length: 'same' });
    assert.ok(hit);
    assert.deepEqual(hit.variants, ['cached variant']);

    const onDisk = JSON.parse(readFileSync(persistPath, 'utf8'));
    assert.equal(onDisk.entries.length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});