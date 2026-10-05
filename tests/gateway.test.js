import { spawn } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

let gatewayProcess;
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const authHeaders = {
  Authorization: `Bearer demo-local-key`,
  'X-Extension-Key': 'demo-local-key',
};

test.before(async () => {
  gatewayProcess = spawn('node', ['api-gateway/server.js'], {
    cwd: projectRoot,
    stdio: 'inherit',
    // Never auto-download models during tests, even when Ollama is installed locally.
    env: { ...process.env, OLLAMA_PULL_IF_MISSING: 'false' },
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
});

test.after(() => {
  if (gatewayProcess) {
    gatewayProcess.kill('SIGTERM');
  }
});

test('gateway health check succeeds', async () => {
  const response = await fetch('http://localhost:3001/health');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.engine.provider, 'ollama');
  assert.equal(body.engine.generateModel, 'gemma2:2b');
  assert.equal(body.engine.embedModel, null);
  assert.equal(typeof body.engine.warm, 'boolean');
  assert.ok(body.semanticCache);
  assert.equal(body.semanticCache.enabled, true);
  assert.equal(typeof body.semanticCache.size, 'number');
});

test('engine setup endpoints require authorization', async () => {
  const setupGet = await fetch('http://localhost:3001/engine/setup');
  assert.equal(setupGet.status, 401);

  const setupPost = await fetch('http://localhost:3001/engine/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(setupPost.status, 401);

  const setupCancel = await fetch('http://localhost:3001/engine/setup/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(setupCancel.status, 401);
});

test('engine setup status reports the preset model', async () => {
  const response = await fetch('http://localhost:3001/engine/setup', { headers: authHeaders });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(typeof body.running, 'boolean');
  assert.equal(typeof body.phase, 'string');
  assert.equal(typeof body.percent, 'number');
});

test('rewrite endpoint returns variants', async () => {
  const response = await fetch('http://localhost:3001/rewrite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      text: 'teh quick brown fox',
      tone: 'professional',
      fidelity: 'balanced',
      length: 'same',
    }),
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body.variants));
  assert.ok(body.variants.length >= 1);
  // Falls back to the stub without Ollama; answers with the on-device engine
  // model when a cached qwen2.5 model is available locally.
  assert.ok(['local-gateway-stub', 'gemma2:2b'].includes(body.model), `unexpected model: ${body.model}`);
});

test('rewrite endpoint rejects unauthorized requests', async () => {
  const response = await fetch('http://localhost:3001/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'hello world', tone: 'professional' }),
  });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error, 'unauthorized');
});

test('rewrite endpoint rejects oversized text', async () => {
  const response = await fetch('http://localhost:3001/rewrite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      text: 'a'.repeat(5000),
      tone: 'professional',
      fidelity: 'balanced',
      length: 'same',
    }),
  });

  assert.equal(response.status, 413);
  const body = await response.json();
  assert.match(body.error, /text exceeds|text is required/i);
});
