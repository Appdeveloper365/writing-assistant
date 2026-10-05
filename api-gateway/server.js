import http from 'node:http';
import {
  cosineSimilarity,
  embedText,
  ensureModelReady,
  generateRewriteWithOllama,
  ollamaSettings,
} from './ollama.js';
import { SemanticCache } from './semanticCache.js';
import { cancelEngineSetup, getSetupState, startEngineSetup } from './engineSetup.js';

const configuredKey = process.env.WRITING_ASSISTANT_API_KEY || process.env.EXTENSION_API_KEY || 'demo-local-key';
const openAiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || '';
const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || '';
const openRouterModel = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const maxTextLength = Number(process.env.MAX_REWRITE_TEXT_LENGTH || 4000);
const rateWindowMs = Number(process.env.REWRITE_RATE_WINDOW_MS || 60000);
const maxRequestsPerWindow = Number(process.env.REWRITE_MAX_REQUESTS_PER_WINDOW || 20);
const requestBuckets = new Map();

const semanticCacheEnabled = String(process.env.SEMANTIC_CACHE_ENABLED ?? 'true').trim().toLowerCase() !== 'false';
const semanticCache = semanticCacheEnabled ? new SemanticCache() : null;
if (semanticCache) {
  const restored = semanticCache.load();
  if (restored > 0) {
    console.log(`[gateway] Restored ${restored} cached rewrite result(s) from disk.`);
  }
}

const engineRetryCooldownMs = Number(process.env.OLLAMA_ENGINE_RETRY_MS || 60000) || 60000;

const engineState = {
  available: false,
  ready: false,
  modelCached: false,
  warmed: false,
  lastWarmAt: null,
  reason: 'warming',
};

let engineTask = null;
let lastEngineAttemptAt = 0;

function warmEngine() {
  // Single-flight: join an in-progress pull/warm instead of starting another one.
  if (engineTask) {
    return engineTask;
  }

  engineTask = (async () => {
    try {
      const result = await ensureModelReady();
      engineState.available = Boolean(result.available);
      engineState.ready = Boolean(result.ready);
      engineState.modelCached = Boolean(result.modelCached);
      engineState.warmed = Boolean(result.warmed);
      engineState.lastWarmAt = new Date().toISOString();
      engineState.reason = result.reason ?? null;

      if (result.ready) {
        console.log(`[gateway] Ollama AI engine ready: ${result.model} cached${result.warmed ? ' and loaded in memory' : ''}.`);
      }
    } catch (error) {
      engineState.ready = false;
      engineState.reason = error instanceof Error ? error.message : 'warm-failed';
    } finally {
      lastEngineAttemptAt = Date.now();
      engineTask = null;
    }
  })();

  return engineTask;
}

async function rankVariantsByFidelity(sourceEmbedding, variants) {
  if (!Array.isArray(sourceEmbedding) || !Array.isArray(variants) || variants.length < 2) {
    return variants;
  }

  const scored = [];
  for (const variant of variants) {
    const vector = await embedText(variant);
    if (!vector) {
      return variants;
    }
    scored.push({ variant, score: cosineSimilarity(sourceEmbedding, vector) });
  }

  return scored.sort((a, b) => b.score - a.score).map((item) => item.variant);
}

function redactSensitiveText(value = '') {
  return String(value)
    .replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '[EMAIL]')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '[PHONE]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b(?:\d{13,19}|\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g, '[CARD]')
    .replace(/\b\d+\s+[A-Za-z0-9 .'-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr)\b/gi, '[ADDRESS]');
}

function sanitizeResponse(value = '') {
  return String(value)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim();
}

function normalizeTone(value) {
  const tone = String(value || 'professional').trim().toLowerCase();
  return ['professional', 'casual', 'concise', 'creative'].includes(tone) ? tone : 'professional';
}

function normalizeLength(value) {
  const length = String(value || 'same').trim().toLowerCase();
  return ['same', 'shorter', 'longer'].includes(length) ? length : 'same';
}

function normalizeFidelity(value) {
  const fidelity = String(value || 'balanced').trim().toLowerCase();
  return ['balanced', 'high', 'creative'].includes(fidelity) ? fidelity : 'balanced';
}

function validatePayload(payload = {}) {
  const text = String(payload.text ?? '').trim();
  if (!text) {
    throw new Error('text is required');
  }
  if (text.length > maxTextLength) {
    throw new Error('text exceeds the max allowed length');
  }

  const provider = String(payload.provider || 'openai').toLowerCase();
  return {
    text,
    tone: normalizeTone(payload.tone),
    fidelity: normalizeFidelity(payload.fidelity),
    length: normalizeLength(payload.length),
    cloudEnabled: Boolean(payload.cloudEnabled),
    provider,
    apiKey: String(payload.apiKey || '').trim(),
    model: String(payload.model || (provider === 'openrouter' ? openRouterModel : 'gpt-4o-mini')).trim(),
  };
}

function getClientIdentifier(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }

  const remoteAddress = req.socket?.remoteAddress || 'unknown';
  return String(remoteAddress).trim() || 'unknown';
}

function isAuthorized(req) {
  const authHeader = String(req.headers.authorization || '').trim();
  const xExtensionKey = String(req.headers['x-extension-key'] || '').trim();
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';

  return Boolean(configuredKey) && (bearerToken === configuredKey || xExtensionKey === configuredKey);
}

function checkRequestBudget(req) {
  const key = getClientIdentifier(req);
  const now = Date.now();
  const current = requestBuckets.get(key) || { windowStart: now, count: 0 };

  if (now - current.windowStart > rateWindowMs) {
    current.windowStart = now;
    current.count = 0;
  }

  current.count += 1;
  requestBuckets.set(key, current);

  return current.count <= maxRequestsPerWindow;
}

function buildFallbackVariants(text, tone) {
  const safeText = sanitizeResponse(redactSensitiveText(text));
  const base = (safeText || 'Your draft').replace(/\s+/g, ' ').trim();

  return [
    `${base} reads more clearly and confidently in a ${tone} tone.`,
    `${base} is smoother and more direct while preserving the original meaning.`,
    `${base} becomes more concise and polished without losing intent.`
  ];
}

async function requestModelRewrite({ provider, text, tone, fidelity, length, apiKey, model }) {
  const maskedText = redactSensitiveText(text);
  const isOpenRouter = provider === 'openrouter';
  const key = isOpenRouter ? (apiKey || openRouterKey) : (openAiKey || apiKey);
  const modelName = String(model || (isOpenRouter ? openRouterModel : 'gpt-4o-mini')).trim();

  if (!key) {
    return null;
  }

  const response = await fetch(isOpenRouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...(isOpenRouter ? { 'HTTP-Referer': 'https://localhost', 'X-Title': 'Writing Assistant Extension' } : {}),
    },
    body: JSON.stringify({
      model: modelName,
      temperature: fidelity === 'creative' ? 0.7 : 0.35,
      messages: [
        {
          role: 'system',
          content: 'Rewrite text while preserving meaning and tone. Output only a JSON array of three strings.'
        },
        {
          role: 'user',
          content: `Rewrite the following text in a ${tone} tone. Preserve intent and keep length ${length}. Output only a JSON array of three rewritten strings. Text: ${maskedText}`
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content ?? '[]';
  const cleaned = String(content).replace(/```json|```/gi, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3).map((item) => sanitizeResponse(String(item)));
    }
    return null;
  } catch {
    return null;
  }
}

async function generateWithOpenAI(text, tone, fidelity, length, model) {
  return requestModelRewrite({
    provider: 'openai',
    text,
    tone,
    fidelity,
    length,
    apiKey: openAiKey,
    model,
  });
}

async function generateWithOpenRouter(text, tone, fidelity, length, apiKey, model) {
  return requestModelRewrite({
    provider: 'openrouter',
    text,
    tone,
    fidelity,
    length,
    apiKey,
    model,
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      mode: openAiKey || openRouterKey ? 'remote' : 'local',
      engine: {
        provider: 'ollama',
        host: ollamaSettings.host,
        generateModel: ollamaSettings.generateModel || null,
        embedModel: ollamaSettings.embedModel || null,
        setup: getSetupState(),
        available: engineState.available,
        modelCached: engineState.modelCached,
        warm: engineState.ready,
        warming: Boolean(engineTask),
        warmed: engineState.warmed,
        lastWarmAt: engineState.lastWarmAt,
        reason: engineState.reason,
      },
      semanticCache: semanticCache ? semanticCache.snapshot() : { enabled: false },
      rateLimit: {
        windowMs: rateWindowMs,
        maxRequestsPerWindow,
      },
    }));
    return;
  }

  if (req.method === 'GET' && req.url === '/engine/setup') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getSetupState()));
    return;
  }

  if (req.method === 'POST' && req.url === '/engine/setup') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8 * 1024) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const state = await startEngineSetup({ model: payload.model });
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'invalid request' }));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/engine/setup/cancel') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cancelEngineSetup()));
    return;
  }

  if (req.method === 'POST' && req.url === '/rewrite') {
    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (!checkRequestBudget(req)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'rate limit exceeded' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        body = body.slice(0, 64 * 1024);
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const safePayload = validatePayload(payload);
        const provider = safePayload.provider;

        // First-use download: when the engine model is not ready yet, pull + warm it
        // in the background (single-flight, cooldown-limited) so later requests can be
        // answered by the on-device engine instead of the heuristic fallback.
        if (
          ollamaSettings.generateModel &&
          !engineState.ready &&
          Date.now() - lastEngineAttemptAt > engineRetryCooldownMs
        ) {
          void warmEngine();
        }

        // 1) Serve from the semantic cache when this exact request (or a near-identical
        //    rewording of it) was already answered by the cached AI engine.
        const sourceEmbedding = semanticCache || ollamaSettings.rankVariants
          ? await embedText(safePayload.text)
          : null;

        if (semanticCache) {
          const cached = semanticCache.lookup({
            text: safePayload.text,
            tone: safePayload.tone,
            fidelity: safePayload.fidelity,
            length: safePayload.length,
            embedding: sourceEmbedding,
          });

          if (cached) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              variants: cached.variants,
              model: cached.model || 'ollama-semantic-cache',
              status: 'ok',
              cache: cached.kind,
              similarity: cached.similarity,
            }));
            return;
          }
        }

        let cloudVariants = null;
        if (safePayload.cloudEnabled) {
          if (provider === 'openrouter') {
            cloudVariants = await generateWithOpenRouter(
              safePayload.text,
              safePayload.tone,
              safePayload.fidelity,
              safePayload.length,
              safePayload.apiKey,
              safePayload.model,
            );
          } else if (openAiKey) {
            cloudVariants = await generateWithOpenAI(
              safePayload.text,
              safePayload.tone,
              safePayload.fidelity,
              safePayload.length,
              safePayload.model,
            );
          }
        }

        // 2) On-device generation with the local Ollama chat model (default engine:
        //    gemma2:2b). Disable with OLLAMA_GENERATE_MODEL=false.
        let ollamaVariants = null;
        if (!cloudVariants && ollamaSettings.generateModel) {
          const generated = await generateRewriteWithOllama({
            text: redactSensitiveText(safePayload.text),
            tone: safePayload.tone,
            fidelity: safePayload.fidelity,
            length: safePayload.length,
          });

          if (generated && generated.length > 0) {
            ollamaVariants = generated
              .map((item) => sanitizeResponse(item))
              .filter(Boolean);
          }
        }

        const generatedVariants = cloudVariants && cloudVariants.length > 0
          ? cloudVariants
          : (ollamaVariants && ollamaVariants.length > 0 ? ollamaVariants : null);
        let finalVariants = generatedVariants || buildFallbackVariants(safePayload.text, safePayload.tone);

        // 3) Rank candidate variants by semantic fidelity to the source using the
        //    optional Ollama embedding model (only when OLLAMA_EMBED_MODEL is set).
        if (sourceEmbedding && ollamaSettings.rankVariants) {
          finalVariants = await rankVariantsByFidelity(sourceEmbedding, finalVariants);
        }

        const usedRemote = safePayload.cloudEnabled && cloudVariants && cloudVariants.length > 0 && ((provider === 'openrouter' && safePayload.apiKey) || openAiKey);
        const modelName = ollamaVariants && ollamaVariants.length > 0
          ? ollamaSettings.generateModel
          : (usedRemote ? (safePayload.model || 'gpt-4o-mini') : 'local-gateway-stub');

        // 4) Store the fresh result so later requests are answered instantly.
        if (semanticCache && finalVariants.length > 0) {
          semanticCache.store({
            text: safePayload.text,
            tone: safePayload.tone,
            fidelity: safePayload.fidelity,
            length: safePayload.length,
            embedding: sourceEmbedding,
            variants: finalVariants,
            model: modelName,
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          variants: finalVariants,
          model: modelName,
          status: 'ok',
          ...(semanticCache ? { cache: 'miss' } : {}),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'invalid request';
        const statusCode = message.includes('text exceeds') || message.includes('text is required') ? 413 : 400;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(Number(process.env.PORT || 3001), () => {
  console.log(`Writing assistant gateway listening on http://localhost:${process.env.PORT || 3001}`);

  // Warm the cached AI engine right away so it is ready for the first user request.
  void warmEngine();

  // Keep the model resident (and persist the cache) over long-running sessions.
  const rewarmIntervalMs = Number(process.env.OLLAMA_REWARM_INTERVAL_MS || 30 * 60 * 1000);
  if (Number.isFinite(rewarmIntervalMs) && rewarmIntervalMs > 0) {
    const timer = setInterval(() => {
      void warmEngine();
      if (semanticCache) {
        semanticCache.save();
      }
    }, rewarmIntervalMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }
});
