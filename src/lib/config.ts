const runtimeEnv: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env as Record<string, string | undefined>) : {};

export type ProviderKind = 'local' | 'openai' | 'azure-openai' | 'anthropic' | 'openrouter';

export const writeAssistantConfig = {
  gatewayUrl: String(runtimeEnv.VITE_GATEWAY_URL ?? 'http://localhost:3001/rewrite'),
  extensionApiKey: String(runtimeEnv.VITE_EXTENSION_API_KEY ?? 'demo-local-key'),
  provider: String(runtimeEnv.VITE_PROVIDER ?? 'local') as ProviderKind,
  model: String(runtimeEnv.VITE_MODEL ?? 'gpt-4o-mini'),
  rewriteEnabled: Boolean(runtimeEnv.VITE_REWRITE_ENABLED ?? true),
  localModeFallback: Boolean(runtimeEnv.VITE_LOCAL_FALLBACK ?? true),
  maxRewriteVariants: Number(runtimeEnv.VITE_MAX_REWRITE_VARIANTS ?? 3),
  debounceMs: Number(runtimeEnv.VITE_DEBOUNCE_MS ?? 250),
  rateLimitPerSecond: Number(runtimeEnv.VITE_RATE_LIMIT_PER_SECOND ?? 3),
  requestTimeoutMs: Number(runtimeEnv.VITE_REQUEST_TIMEOUT_MS ?? 12000),
};

export function isCloudProviderEnabled() {
  return writeAssistantConfig.provider !== 'local' && writeAssistantConfig.rewriteEnabled;
}

export function getProviderStrategy() {
  return {
    provider: writeAssistantConfig.provider,
    model: writeAssistantConfig.model,
    gatewayUrl: writeAssistantConfig.gatewayUrl,
    requiresEnvKey: writeAssistantConfig.provider !== 'local',
  };
}
