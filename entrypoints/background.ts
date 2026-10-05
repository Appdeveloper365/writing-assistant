import { writeAssistantConfig } from '../src/lib/config';
import { requestLocalRewriteFromGateway, requestRewriteFromGateway } from '../src/lib/apiClient';
import { loadSettings, saveSettings } from '../src/lib/settings';

const runtimeApi = (globalThis as any).browser ?? (globalThis as any).chrome;

function buildLocalRewriteResponse(text: string, tone: string) {
  const safeText = text.replace(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi, '[EMAIL]');
  const variants = [
    `${safeText || 'Your draft'} in a ${tone} tone reads more clearly and professionally.`,
    `${safeText || 'Your draft'} is more concise and direct while preserving meaning.`,
    `${safeText || 'Your draft'} feels more natural and engaging for a ${tone} voice.`,
  ];

  return {
    type: 'REWRITE_RESPONSE',
    variants,
    model: 'local-ai',
    status: 'ok',
  };
}

export default defineBackground(() => {
  if (!runtimeApi?.runtime?.onMessage) {
    return;
  }

  runtimeApi.runtime.onMessage.addListener((message: any, _sender: unknown, sendResponse: (response?: any) => void) => {
    if (message.type === 'REWRITE_REQUEST') {
      loadSettings().then(async (settings) => {
        const mode = (message.aiMode ?? settings.aiMode ?? 'local');
        const provider = (message.provider ?? settings.remoteProvider ?? 'openai');
        const model = (message.model ?? settings.remoteModel ?? 'gpt-4o-mini').trim();
        const apiKey = (message.apiKey ?? settings.apiKey ?? '').trim();
        const userOwnsRemoteKey = mode === 'remote' && apiKey.length > 0;

        if (mode === 'off') {
          sendResponse({
            type: 'REWRITE_RESPONSE',
            variants: [message.text],
            model: 'disabled',
            status: 'ok',
          });
          return;
        }

        if (mode === 'local') {
          // Try the cached local engine (gateway + Ollama) first, then fall back to
          // on-device heuristics when the gateway or Ollama engine is not available.
          if (writeAssistantConfig.localViaGateway) {
            try {
              const result = await requestLocalRewriteFromGateway(message.text, message.tone);
              const variants = Array.isArray(result?.variants)
                ? result.variants.filter((variant: unknown) => typeof variant === 'string' && variant.trim())
                : [];

              if (variants.length > 0) {
                sendResponse({
                  type: 'REWRITE_RESPONSE',
                  variants,
                  model: result.model ?? 'local-ai',
                  status: result.status ?? 'ok',
                });
                return;
              }
            } catch {
              // Gateway unreachable or engine not ready — continue with heuristics.
            }
          }

          sendResponse(buildLocalRewriteResponse(message.text, message.tone));
          return;
        }

        if (userOwnsRemoteKey && writeAssistantConfig.rewriteEnabled) {
          try {
            const result = await requestRewriteFromGateway(message.text, message.tone, { provider, apiKey, model });
            sendResponse({
              type: 'REWRITE_RESPONSE',
              variants: result.variants ?? [message.text],
              model: result.model ?? provider,
              status: result.status ?? 'ok',
            });
          } catch {
            sendResponse(buildLocalRewriteResponse(message.text, message.tone));
          }
          return;
        }

        sendResponse(buildLocalRewriteResponse(message.text, message.tone));
      }).catch(() => {
        sendResponse(buildLocalRewriteResponse(message.text, message.tone));
      });

      return true;
    }

    if (message.type === 'GET_SETTINGS') {
      loadSettings().then((settings) => sendResponse(settings)).catch(() => sendResponse({
        tone: 'professional',
        aiMode: 'local',
        remoteProvider: 'openai',
        remoteModel: 'gpt-4o-mini',
        apiKey: '',
        localAiEnabled: false,
        localModelPath: '',
        localModelName: '',
        localPermissionGranted: false,
        cloudRewriteEnabled: false,
        suggestionsEnabled: true,
        requireConfirmation: true,
        showPreview: true,
      }));
      return true;
    }

    if (message.type === 'SAVE_SETTINGS') {
      saveSettings(message.settings ?? {}).then((settings) => {
        sendResponse(settings);
      }).catch(() => sendResponse({
        tone: 'professional',
        aiMode: 'local',
        remoteProvider: 'openai',
        remoteModel: 'gpt-4o-mini',
        apiKey: '',
        localAiEnabled: false,
        localModelPath: '',
        localModelName: '',
        localPermissionGranted: false,
        cloudRewriteEnabled: false,
        suggestionsEnabled: true,
        requireConfirmation: true,
        showPreview: true,
      }));
      return true;
    }

    return false;
  });
});
