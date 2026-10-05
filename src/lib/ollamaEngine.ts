import { writeAssistantConfig } from './config';
import { createPullProgressTracker, type PullProgressUpdate } from './pullProgress';

export type OllamaEngineStatus = {
  host: string;
  model: string;
  available: boolean;
  modelCached: boolean;
  message: string;
};

function isModelCached(names: string[], model: string): boolean {
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

function primaryModel(): string {
  return (writeAssistantConfig.ollamaGenerateModel || writeAssistantConfig.ollamaEmbedModel || '').trim();
}

/**
 * Whether the app should download the engine model automatically on first use.
 */
export function isAutoDownloadEnabled(): boolean {
  return writeAssistantConfig.ollamaAutoDownload;
}

function buildStatus(partial: Partial<OllamaEngineStatus> = {}): OllamaEngineStatus {
  return {
    host: writeAssistantConfig.ollamaHost,
    model: primaryModel(),
    available: false,
    modelCached: false,
    message: '',
    ...partial,
  };
}

/**
 * Checks whether the local Ollama engine is running and the engine model is cached,
 * so the AI engine is ready before the user needs it.
 */
export async function fetchOllamaEngineStatus(timeoutMs = 2500): Promise<OllamaEngineStatus> {
  const host = writeAssistantConfig.ollamaHost;
  const model = primaryModel();

  if (!model) {
    return buildStatus({ message: 'No local model configured (set OLLAMA_GENERATE_MODEL).' });
  }

  try {
    const response = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return buildStatus({ message: `Ollama responded with status ${response.status}.` });
    }

    const data = await response.json();
    const names = Array.isArray(data?.models)
      ? data.models
          .map((entry: any) => String(entry?.name ?? '').trim())
          .filter(Boolean)
      : [];
    const modelCached = isModelCached(names, model);

    return buildStatus({
      available: true,
      modelCached,
      message: modelCached
        ? `Ollama is running — ${model} is cached and ready for on-device rewrites.`
        : 'Ollama is running, but the engine model is not cached yet. Run "npm run ai:warm" or use Warm up engine.',
    });
  } catch {
    return buildStatus({
      message: 'Ollama was not detected on this device. Install it from ollama.com to enable the cached local engine.',
    });
  }
}

/**
 * Loads the engine model into memory (`keep_alive`) with a minimal one-token call,
 * so the first rewrite request is served instantly.
 */
export async function warmOllamaEngine(timeoutMs = 30000): Promise<OllamaEngineStatus> {
  const host = writeAssistantConfig.ollamaHost;
  const generateModel = (writeAssistantConfig.ollamaGenerateModel || '').trim();
  const embedModel = (writeAssistantConfig.ollamaEmbedModel || '').trim();
  const model = generateModel || embedModel;

  if (!model) {
    return buildStatus({ message: 'No local model configured (set OLLAMA_GENERATE_MODEL).' });
  }

  try {
    if (generateModel) {
      const response = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: generateModel,
          stream: false,
          keep_alive: '24h',
          messages: [{ role: 'user', content: 'warm up the writing assistant engine' }],
          options: { num_predict: 1 },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.ok) {
        return buildStatus({
          available: true,
          modelCached: true,
          message: `${generateModel} warmed up — loaded in memory and ready for on-device rewrites.`,
        });
      }

      return buildStatus({
        available: true,
        message: 'Ollama is running but the engine could not be warmed up. Run "npm run ai:warm" to cache the model.',
      });
    }

    let response = await fetch(`${host}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: embedModel, input: 'warm up the writing assistant engine', keep_alive: '24h' }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      // Legacy Ollama API (< 0.5) fallback.
      response = await fetch(`${host}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: embedModel, prompt: 'warm up the writing assistant engine', keep_alive: '24h' }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    }

    if (!response.ok) {
      return buildStatus({ available: true, message: 'Ollama is running but the engine could not be warmed up.' });
    }

    return buildStatus({
      available: true,
      modelCached: true,
      message: 'Engine warmed up — the model is loaded in memory and ready for users.',
    });
  } catch {
    return fetchOllamaEngineStatus(timeoutMs);
  }
}

export { createPullProgressTracker } from './pullProgress';
export type { PullProgressUpdate } from './pullProgress';

function gatewayBaseUrl(): string {
  const url = String(writeAssistantConfig.gatewayUrl || '').trim();
  if (!url) {
    return '';
  }
  return url.replace(/\/rewrite\/?$/, '');
}

function gatewayAuthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${writeAssistantConfig.extensionApiKey}`,
    'X-Extension-Key': writeAssistantConfig.extensionApiKey,
    'X-Provider': 'local',
  };
}

export type EngineSetupState = {
  running: boolean;
  phase: string;
  message: string;
  percent: number;
  model: string;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

function normalizeSetupState(value: any): EngineSetupState {
  return {
    running: Boolean(value?.running),
    phase: String(value?.phase ?? 'idle'),
    message: String(value?.message ?? ''),
    percent: Number.isFinite(Number(value?.percent)) ? Number(value.percent) : 0,
    model: String(value?.model ?? ''),
    error: value?.error == null ? null : String(value.error),
    startedAt: value?.startedAt ?? null,
    finishedAt: value?.finishedAt ?? null,
  };
}

/**
 * Starts the preset gateway-managed setup (install Ollama if missing,
 * download gemma2:2b with progress, warm it). Returns null when the gateway
 * cannot be reached — callers can fall back to the direct model download.
 */
export async function startGatewayEngineSetup(): Promise<EngineSetupState | null> {
  const base = gatewayBaseUrl();
  if (!base) {
    return null;
  }

  try {
    const response = await fetch(`${base}/engine/setup`, {
      method: 'POST',
      headers: gatewayAuthHeaders(),
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(writeAssistantConfig.requestTimeoutMs),
    });

    if (!response.ok) {
      return null;
    }

    return normalizeSetupState(await response.json());
  } catch {
    return null;
  }
}

/**
 * Polls the gateway-managed setup state. Returns null when the gateway
 * cannot be reached.
 */
export async function fetchGatewayEngineSetup(): Promise<EngineSetupState | null> {
  const base = gatewayBaseUrl();
  if (!base) {
    return null;
  }

  try {
    const response = await fetch(`${base}/engine/setup`, {
      method: 'GET',
      headers: gatewayAuthHeaders(),
      signal: AbortSignal.timeout(writeAssistantConfig.requestTimeoutMs),
    });

    if (!response.ok) {
      return null;
    }

    return normalizeSetupState(await response.json());
  } catch {
    return null;
  }
}

/**
 * Cancels a running gateway-managed setup. Returns null when the gateway
 * cannot be reached.
 */
export async function cancelGatewayEngineSetup(): Promise<EngineSetupState | null> {
  const base = gatewayBaseUrl();
  if (!base) {
    return null;
  }

  try {
    const response = await fetch(`${base}/engine/setup/cancel`, {
      method: 'POST',
      headers: gatewayAuthHeaders(),
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(writeAssistantConfig.requestTimeoutMs),
    });

    if (!response.ok) {
      return null;
    }

    return normalizeSetupState(await response.json());
  } catch {
    return null;
  }
}

/**
 * Downloads the engine model into Ollama (first-use download) with streaming progress,
 * then warms it into memory so it is ready immediately. Cancellable via `options.signal`.
 */
export async function downloadOllamaModel(
  onProgress?: (update: PullProgressUpdate) => void,
  options: { signal?: AbortSignal } = {},
): Promise<OllamaEngineStatus> {
  const host = writeAssistantConfig.ollamaHost;
  const model = primaryModel();

  if (!model) {
    return buildStatus({ message: 'No local model configured (set OLLAMA_GENERATE_MODEL).' });
  }

  try {
    const response = await fetch(`${host}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, name: model, stream: true, keep_alive: '24h' }),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (!response.ok || !response.body) {
      return buildStatus({
        available: true,
        message: `Model download failed (HTTP ${response.status}). Check the model name and Ollama logs.`,
      });
    }

    onProgress?.({ status: `downloading ${model}`, percent: 0, done: false });

    const tracker = createPullProgressTracker();
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
        if (update) {
          onProgress?.(update);
        }
      }
    }

    if (!tracker.isDone()) {
      return buildStatus({
        available: true,
        message: 'Model download ended unexpectedly. Use Download again to resume.',
      });
    }

    onProgress?.({ status: 'success', percent: 100, done: true });

    // Load the freshly downloaded model into memory right away.
    return await warmOllamaEngine();
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      return buildStatus({
        available: true,
        message: 'Download stopped. Start it again any time — partial downloads resume.',
      });
    }

    return buildStatus({
      message: 'Ollama was not detected on this device. Install it from ollama.com, then the model downloads here automatically.',
    });
  }
}