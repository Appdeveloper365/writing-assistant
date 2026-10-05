const DEFAULT_HOST = 'http://127.0.0.1:11434';
// Low-memory generative model used as the default on-device AI engine (~1.6 GB RAM).
// Alternatives: qwen2.5:0.5b (~400 MB), qwen2.5:1.5b (~1.1 GB). Set to '' / 'false' to disable.
const DEFAULT_GENERATE_MODEL = 'gemma2:2b';
// Optional embedding model (e.g. 'paraphrase-multilingual:278m') for embedding-based
// semantic caching and fidelity ranking. Disabled by default to keep memory low;
// the semantic cache falls back to fuzzy text matching when this is empty.
const DEFAULT_EMBED_MODEL = '';

function envFlag(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === '') {
    return fallback;
  }
  return !['false', '0', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

function envNumber(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function normalizeModelName(value) {
  const text = String(value ?? '').trim();
  if (['', 'false', 'none', 'off', '0'].includes(text.toLowerCase())) {
    return '';
  }
  return text;
}

function envModel(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) {
    return fallback;
  }
  return normalizeModelName(raw);
}

/**
 * Ollama engine settings.
 *
 * The default engine is a tiny local chat model (`gemma2:2b`) that actually
 * generates rewrites on-device with low memory. An optional embedding model
 * (e.g. `paraphrase-multilingual:278m`) can be enabled via `OLLAMA_EMBED_MODEL`
 * for embedding-based semantic caching and fidelity ranking.
 */
export const ollamaSettings = {
  host: String(process.env.OLLAMA_HOST || DEFAULT_HOST).replace(/\/+$/, ''),
  generateModel: envModel('OLLAMA_GENERATE_MODEL', DEFAULT_GENERATE_MODEL),
  embedModel: envModel('OLLAMA_EMBED_MODEL', DEFAULT_EMBED_MODEL),
  keepAlive: String(process.env.OLLAMA_KEEP_ALIVE || '24h').trim(),
  pullIfMissing: envFlag('OLLAMA_PULL_IF_MISSING', true),
  rankVariants: envFlag('OLLAMA_RANK_VARIANTS', true),
  statusTimeoutMs: envNumber('OLLAMA_STATUS_TIMEOUT_MS', 2000),
  embedTimeoutMs: envNumber('OLLAMA_EMBED_TIMEOUT_MS', 8000),
  pullTimeoutMs: envNumber('OLLAMA_PULL_TIMEOUT_MS', 10 * 60 * 1000),
  warmTimeoutMs: envNumber('OLLAMA_WARM_TIMEOUT_MS', 60000),
  generateTimeoutMs: envNumber('OLLAMA_GENERATE_TIMEOUT_MS', 20000),
};

export function getOllamaSettings() {
  return { ...ollamaSettings };
}

async function ollamaRequest(pathname, options = {}) {
  const {
    method = 'GET',
    body,
    host = ollamaSettings.host,
    timeoutMs = ollamaSettings.statusTimeoutMs,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${host}${pathname}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Matches an installed Ollama model name against the requested model.
 * A requested model without an explicit tag matches any tag; otherwise the tag must match.
 */
export function isModelCached(names = [], model) {
  const wanted = String(model ?? '').trim().toLowerCase();
  if (!wanted) {
    return false;
  }

  const wantedParts = wanted.split(':');
  const wantedBase = wantedParts[0];
  const wantedTag = wantedParts.length > 1 ? wantedParts[1] : null;

  return names.some((entry) => {
    const name = String(entry ?? '').trim().toLowerCase();
    if (!name) {
      return false;
    }

    const parts = name.split(':');
    const base = parts[0];
    const tag = parts.length > 1 ? parts[1] : 'latest';
    if (base !== wantedBase) {
      return false;
    }

    return wantedTag === null || tag === wantedTag;
  });
}

export async function getInstalledModels(options = {}) {
  const { host = ollamaSettings.host, timeoutMs = ollamaSettings.statusTimeoutMs } = options;
  const data = await ollamaRequest('/api/tags', { host, timeoutMs });

  if (!data || !Array.isArray(data.models)) {
    return { available: false, models: [] };
  }

  const models = data.models
    .map((entry) => String(entry?.name ?? '').trim())
    .filter(Boolean);

  return { available: true, models };
}

export async function getOllamaStatus(options = {}) {
  const {
    host = ollamaSettings.host,
    model = ollamaSettings.embedModel,
    timeoutMs = ollamaSettings.statusTimeoutMs,
  } = options;

  const { available, models } = await getInstalledModels({ host, timeoutMs });

  return {
    available,
    model,
    modelCached: available ? isModelCached(models, model) : false,
    host,
    models: available ? models : [],
  };
}

/**
 * Embeds text with the local Ollama embedding model. Returns a number vector or null
 * when Ollama is unreachable or the model cannot produce an embedding.
 */
export async function embedText(text, options = {}) {
  const {
    host = ollamaSettings.host,
    model = ollamaSettings.embedModel,
    keepAlive = ollamaSettings.keepAlive,
    timeoutMs = ollamaSettings.embedTimeoutMs,
  } = options;

  const input = String(text ?? '').trim();
  const targetModel = normalizeModelName(model);
  if (!input || !targetModel) {
    return null;
  }

  let data = await ollamaRequest('/api/embed', {
    method: 'POST',
    host,
    timeoutMs,
    body: { model, input, keep_alive: keepAlive },
  });

  let vector = Array.isArray(data?.embeddings?.[0]) ? data.embeddings[0] : null;

  if (!vector) {
    // Legacy Ollama API (< 0.5) used /api/embeddings with a `prompt` field.
    data = await ollamaRequest('/api/embeddings', {
      method: 'POST',
      host,
      timeoutMs,
      body: { model, prompt: input, keep_alive: keepAlive },
    });
    vector = Array.isArray(data?.embedding) ? data.embedding : null;
  }

  if (!Array.isArray(vector) || vector.length === 0) {
    return null;
  }

  const numbers = vector.map((value) => Number(value));
  return numbers.every((value) => Number.isFinite(value)) ? numbers : null;
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    const av = Number(a[index]);
    const bv = Number(b[index]);
    if (!Number.isFinite(av) || !Number.isFinite(bv)) {
      return 0;
    }
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Loads a generative model into memory with a minimal one-token chat call so the
 * first real rewrite request is instant. Returns true when the model responded.
 */
export async function warmChatModel(options = {}) {
  const {
    host = ollamaSettings.host,
    model = ollamaSettings.generateModel,
    keepAlive = ollamaSettings.keepAlive,
    timeoutMs = ollamaSettings.warmTimeoutMs,
  } = options;

  const targetModel = normalizeModelName(model);
  if (!targetModel) {
    return false;
  }

  const data = await ollamaRequest('/api/chat', {
    method: 'POST',
    host,
    timeoutMs,
    body: {
      model: targetModel,
      stream: false,
      keep_alive: keepAlive,
      messages: [{ role: 'user', content: 'warm up the writing assistant engine' }],
      options: { num_predict: 1 },
    },
  });

  return Boolean(data);
}

/**
 * Makes sure the configured models are cached on disk (one-time pull) and preloaded
 * into memory with a `keep_alive` warm-up call, so the first user request is instant.
 */
export async function ensureModelReady(options = {}) {
  const host = options.host ?? ollamaSettings.host;
  const pullIfMissing = options.pullIfMissing ?? ollamaSettings.pullIfMissing;
  const log = options.log ?? null;
  const generateModel = 'generateModel' in options
    ? normalizeModelName(options.generateModel)
    : ollamaSettings.generateModel;
  const embedModel = 'embedModel' in options
    ? normalizeModelName(options.embedModel)
    : ollamaSettings.embedModel;
  const targets = [generateModel, embedModel].filter(Boolean);
  const primaryModel = targets[0] || '';

  const status = await getOllamaStatus({ host, model: primaryModel });

  if (!status.available) {
    return {
      ready: false,
      available: false,
      modelCached: false,
      warmed: false,
      pulled: false,
      model: primaryModel,
      generateModel,
      embedModel,
      reason: 'ollama-unavailable',
    };
  }

  if (targets.length === 0) {
    return {
      ready: false,
      available: true,
      modelCached: false,
      warmed: false,
      pulled: false,
      model: '',
      generateModel,
      embedModel,
      reason: 'no-model-configured',
    };
  }

  let pulled = false;
  for (const target of targets) {
    if (isModelCached(status.models, target)) {
      continue;
    }

    if (!pullIfMissing) {
      return {
        ready: false,
        available: true,
        modelCached: false,
        warmed: false,
        pulled,
        model: target,
        generateModel,
        embedModel,
        reason: 'model-not-cached',
      };
    }

    if (log) {
      log(`Caching Ollama model ${target} (one-time download) ...`);
    }

    const pullResult = await ollamaRequest('/api/pull', {
      method: 'POST',
      host,
      timeoutMs: ollamaSettings.pullTimeoutMs,
      body: { name: target, stream: false, keep_alive: ollamaSettings.keepAlive },
    });

    if (!pullResult) {
      return {
        ready: false,
        available: true,
        modelCached: false,
        warmed: false,
        pulled,
        model: target,
        generateModel,
        embedModel,
        reason: 'pull-failed',
      };
    }

    status.models.push(target);
    pulled = true;
  }

  let warmed = false;

  if (generateModel) {
    const generateWarmed = await warmChatModel({ host, model: generateModel });
    warmed = generateWarmed || warmed;
    if (log) {
      log(
        generateWarmed
          ? `Generative model ${generateModel} is cached and loaded in memory.`
          : `Generative model ${generateModel} is cached on disk but could not be preloaded.`,
      );
    }
  }

  if (embedModel) {
    const embedWarmed = Boolean(await embedText('warm up the writing assistant engine', { host, model: embedModel }));
    warmed = embedWarmed || warmed;
    if (log) {
      log(
        embedWarmed
          ? `Embedding model ${embedModel} is cached and loaded in memory.`
          : `Embedding model ${embedModel} is cached on disk but could not be preloaded.`,
      );
    }
  }

  return {
    ready: true,
    available: true,
    modelCached: true,
    pulled,
    warmed,
    model: primaryModel,
    generateModel,
    embedModel,
    host: status.host,
  };
}

/**
 * Optional on-device rewrite generation. Only runs when `OLLAMA_GENERATE_MODEL` points at
 * a local chat model. Returns an array of rewritten strings or null.
 */
export async function generateRewriteWithOllama(options = {}) {
  const {
    text,
    tone = 'professional',
    fidelity = 'balanced',
    length = 'same',
    host = ollamaSettings.host,
    model = ollamaSettings.generateModel,
    keepAlive = ollamaSettings.keepAlive,
    timeoutMs = ollamaSettings.generateTimeoutMs,
  } = options;

  const targetModel = String(model || '').trim();
  const sourceText = String(text ?? '').trim();
  if (!targetModel || !sourceText) {
    return null;
  }

  const data = await ollamaRequest('/api/chat', {
    method: 'POST',
    host,
    timeoutMs,
    body: {
      model: targetModel,
      stream: false,
      keep_alive: keepAlive,
      format: 'json',
      options: { temperature: fidelity === 'creative' ? 0.7 : 0.35, num_predict: 256 },
      messages: [
        {
          role: 'system',
          content: 'You rewrite text while preserving meaning. Respond ONLY with a JSON array of three rewritten strings.',
        },
        {
          role: 'user',
          content: `Rewrite the following text in a ${tone} tone. Preserve intent and keep length ${length}. Output only a JSON array of three rewritten strings. Text: ${sourceText}`,
        },
      ],
    },
  });

  const content = data?.message?.content;
  if (!content) {
    return null;
  }

  const cleaned = String(content).replace(/```json|```/gi, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 3).map((item) => String(item));
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Aggregates Ollama streaming pull progress (NDJSON) into an overall percent.
 * Pure helper — unit testable.
 */
export function createPullTracker() {
  const layers = new Map();
  let done = false;
  let status = 'starting';

  return {
    onLine(line) {
      const trimmed = String(line ?? '').trim();
      if (!trimmed) {
        return null;
      }

      let data;
      try {
        data = JSON.parse(trimmed);
      } catch {
        return null;
      }

      if (typeof data.status === 'string' && data.status) {
        status = data.status;
      }
      if (data.status === 'success') {
        done = true;
      }

      if (data.digest) {
        const key = String(data.digest);
        const total = Number(data.total);
        const completed = Number(data.completed);
        const existing = layers.get(key);
        if (Number.isFinite(total) && total > 0) {
          layers.set(key, { total, completed: Number.isFinite(completed) ? completed : 0 });
        } else if (existing && Number.isFinite(completed)) {
          existing.completed = completed;
        }
      }

      let total = 0;
      let completed = 0;
      for (const layer of layers.values()) {
        total += layer.total;
        completed += Math.min(layer.completed, layer.total);
      }

      const percent = done
        ? 100
        : (total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0);

      return { status, percent, done };
    },
    isDone() {
      return done;
    },
  };
}

/**
 * Pulls an Ollama model with streaming progress. onProgress receives
 * `{ status, percent, done }`. Resolves true on success; throws otherwise.
 * Cancel with `options.signal`.
 */
export async function pullModelWithProgress(modelName, onProgress = null, options = {}) {
  const {
    host = ollamaSettings.host,
    keepAlive = ollamaSettings.keepAlive,
    timeoutMs = envNumber('OLLAMA_PULL_STREAM_TIMEOUT_MS', 30 * 60 * 1000),
  } = options;

  const targetModel = normalizeModelName(modelName);
  if (!targetModel) {
    throw new Error('no model specified');
  }

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const forwardAbort = () => controller.abort();

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', forwardAbort, { once: true });
    }
  }

  try {
    const response = await fetch(`${host}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: targetModel, model: targetModel, stream: true, keep_alive: keepAlive }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`pull request failed (HTTP ${response.status || 'unknown'})`);
    }

    const tracker = createPullTracker();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done: readerDone, value } = await reader.read();
      if (readerDone) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const update = tracker.onLine(line);
        if (update && typeof onProgress === 'function') {
          onProgress(update);
        }
      }
    }

    if (!tracker.isDone()) {
      throw new Error('pull ended without success');
    }

    return true;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    if (options.signal) {
      options.signal.removeEventListener('abort', forwardAbort);
    }
  }
}