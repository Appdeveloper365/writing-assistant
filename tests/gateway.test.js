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
  gatewayProcess = spawn('node', ['api-gateway/server.js'], { cwd: projectRoot, stdio: 'inherit' });
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
  assert.equal(body.model, 'local-gateway-stub');
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
