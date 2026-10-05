import { test, expect } from '@playwright/test';

test('gateway is healthy', async ({ request }) => {
  const response = await request.get('http://localhost:3001/health');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.ok).toBe(true);
});

test('rewrite endpoint returns candidate variants', async ({ request }) => {
  const response = await request.post('http://localhost:3001/rewrite', {
    data: {
      text: 'teh quick brown fox',
      tone: 'professional',
      fidelity: 'balanced',
      length: 'same',
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.variants)).toBeTruthy();
  expect(body.variants.length).toBeGreaterThan(0);
  // Stub without Ollama, or the on-device engine model when gemma2:2b is cached.
  expect(['local-gateway-stub', 'gemma2:2b']).toContain(body.model);
});
