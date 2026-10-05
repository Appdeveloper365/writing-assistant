import { writeAssistantConfig } from './config';
import { validateRemoteAiSettings } from './settings';

export type GatewayRewritePayload = {
  text: string;
  tone: string;
  fidelity?: 'strict' | 'balanced';
  length?: 'same' | 'shorter' | 'longer';
  cloudEnabled?: boolean;
  provider?: string;
  apiKey?: string;
  model?: string;
};

export async function requestRewriteFromGateway(
  text: string,
  tone: string,
  options: { provider?: string; apiKey?: string; model?: string } = {},
) {
  const provider = options.provider ?? 'openai';
  const apiKey = (options.apiKey ?? '').trim();
  const model = (options.model ?? 'gpt-4o-mini').trim();

  const validation = validateRemoteAiSettings({
    aiMode: 'remote',
    remoteProvider: provider as 'openai' | 'azure-openai' | 'anthropic' | 'openrouter',
    apiKey,
  });

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const payload: GatewayRewritePayload = {
    text,
    tone,
    fidelity: 'balanced',
    length: 'same',
    cloudEnabled: writeAssistantConfig.rewriteEnabled,
    provider,
    apiKey,
    model,
  };

  const response = await fetch(writeAssistantConfig.gatewayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'X-Extension-Key': apiKey,
      'X-Provider': provider,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Gateway returned an error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Local AI mode request: routes through the gateway so the cached Ollama engine
 * (semantic cache + optional on-device generation) can answer. Cloud generation is
 * explicitly disabled; the gateway falls back to local heuristics when the engine
 * is unavailable, and the caller falls back to heuristics when the gateway is down.
 */
export async function requestLocalRewriteFromGateway(text: string, tone: string) {
  const payload: GatewayRewritePayload = {
    text,
    tone,
    fidelity: 'balanced',
    length: 'same',
    cloudEnabled: false,
    provider: 'local',
  };

  const response = await fetch(writeAssistantConfig.gatewayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${writeAssistantConfig.extensionApiKey}`,
      'X-Extension-Key': writeAssistantConfig.extensionApiKey,
      'X-Provider': 'local',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(writeAssistantConfig.requestTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Gateway returned an error: ${response.status}`);
  }

  return await response.json();
}
