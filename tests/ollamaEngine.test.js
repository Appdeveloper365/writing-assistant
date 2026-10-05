import test from 'node:test';
import assert from 'node:assert/strict';
import { createPullProgressTracker } from '../src/lib/pullProgress.ts';
import { writeAssistantConfig } from '../src/lib/config.ts';

test('pull progress tracker aggregates layer downloads into a percent', () => {
  const tracker = createPullProgressTracker();

  assert.equal(tracker.onLine(''), null);
  assert.equal(tracker.onLine('not-json'), null);

  const start = tracker.onLine(JSON.stringify({ status: 'pulling manifest' }));
  assert.ok(start);
  assert.equal(start.status, 'pulling manifest');
  assert.equal(start.percent, 0);
  assert.equal(start.done, false);

  const layerA = tracker.onLine(JSON.stringify({ status: 'downloading', digest: 'sha256:aaa', total: 1000, completed: 250 }));
  assert.equal(layerA.percent, 25);

  const layerB = tracker.onLine(JSON.stringify({ status: 'downloading', digest: 'sha256:bbb', total: 1000, completed: 500 }));
  assert.equal(layerB.percent, 38); // 750 / 2000 rounded

  const resumed = tracker.onLine(JSON.stringify({ status: 'downloading', digest: 'sha256:aaa', total: 1000, completed: 1000 }));
  assert.equal(resumed.percent, 75); // 1500 / 2000

  const success = tracker.onLine(JSON.stringify({ status: 'success' }));
  assert.equal(success.done, true);
  assert.equal(success.percent, 100);
  assert.equal(tracker.isDone(), true);
});

test('model auto-download is enabled by default', () => {
  assert.equal(typeof writeAssistantConfig.ollamaAutoDownload, 'boolean');
  assert.equal(writeAssistantConfig.ollamaAutoDownload, true);
});