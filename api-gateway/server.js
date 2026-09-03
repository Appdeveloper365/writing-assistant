import http from 'node:http';

const configuredKey = process.env.WRITING_ASSISTANT_API_KEY || process.env.EXTENSION_API_KEY || 'demo-local-key';
const openAiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || '';
const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || '';
const openRouterModel = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const maxTextLength = Number(process.env.MAX_REWRITE_TEXT_LENGTH || 4000);
const rateWindowMs = Number(process.env.REWRITE_RATE_WINDOW_MS || 60000);
const maxRequestsPerWindow = Number(process.env.REWRITE_MAX_REQUESTS_PER_WINDOW || 20);
const requestBuckets = new Map();

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
      rateLimit: {
        windowMs: rateWindowMs,
        maxRequestsPerWindow,
      },
    }));
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

        let variants = null;
        if (safePayload.cloudEnabled) {
          if (provider === 'openrouter') {
            variants = await generateWithOpenRouter(
              safePayload.text,
              safePayload.tone,
              safePayload.fidelity,
              safePayload.length,
              safePayload.apiKey,
              safePayload.model,
            );
          } else if (openAiKey) {
            variants = await generateWithOpenAI(
              safePayload.text,
              safePayload.tone,
              safePayload.fidelity,
              safePayload.length,
              safePayload.model,
            );
          }
        }

        const finalVariants = variants && variants.length > 0 ? variants : buildFallbackVariants(safePayload.text, safePayload.tone);
        const usedRemote = safePayload.cloudEnabled && variants && variants.length > 0 && ((provider === 'openrouter' && safePayload.apiKey) || openAiKey);
        const modelName = usedRemote ? (safePayload.model || 'gpt-4o-mini') : 'local-gateway-stub';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          variants: finalVariants,
          model: modelName,
          status: 'ok',
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
});
