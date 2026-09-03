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
