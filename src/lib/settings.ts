export type LocalModelEntry = {
  name: string;
  path: string;
};

export const DEFAULT_SETTINGS = {
  tone: 'professional',
  aiMode: 'local',
  remoteProvider: 'openai',
  remoteModel: 'gpt-4o-mini',
  apiKey: '',
  localAiEnabled: false,
  localModelPath: '',
  localModelName: '',
  localModelHistory: [] as LocalModelEntry[],
  localPermissionGranted: false,
  cloudRewriteEnabled: false,
  suggestionsEnabled: true,
  requireConfirmation: true,
  showPreview: true,
};

export type AiMode = 'local' | 'remote' | 'off';
export type RemoteProvider = 'openai' | 'azure-openai' | 'anthropic' | 'openrouter';
export type Settings = typeof DEFAULT_SETTINGS;

const storageApi = (globalThis as any).browser?.storage ?? (globalThis as any).chrome?.storage;

export function getRemoteProviderLabel(provider: RemoteProvider | string): string {
  switch (provider) {
    case 'azure-openai':
      return 'Azure OpenAI';
    case 'anthropic':
      return 'Anthropic';
    case 'openrouter':
      return 'OpenRouter';
    case 'openai':
    default:
      return 'OpenAI';
  }
}

export function validateRemoteAiSettings(settings: Partial<Settings> = {}): {
  valid: boolean;
  providerLabel: string;
  message: string;
} {
  const mode = settings.aiMode ?? DEFAULT_SETTINGS.aiMode;
  const provider = settings.remoteProvider ?? DEFAULT_SETTINGS.remoteProvider;
  const apiKey = (settings.apiKey ?? '').trim();
  const providerLabel = getRemoteProviderLabel(provider);

  if (mode !== 'remote') {
    return {
      valid: true,
      providerLabel,
      message: 'Local AI and Off mode stay on-device and do not require an API subscription.',
    };
  }

  if (!apiKey) {
    return {
      valid: false,
      providerLabel,
      message: `Add your own ${providerLabel} API key to enable Remote AI. You pay the provider directly; the seller does not cover AI costs.`,
    };
  }

  return {
    valid: true,
    providerLabel,
    message: `Remote rewrite is using your own ${providerLabel} API key. The provider bill belongs to you, not the extension seller.`,
  };
}

function normalizeLocalModelHistory(value: unknown): LocalModelEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item: any) => ({
      name: String(item.name ?? '').trim(),
      path: String(item.path ?? '').trim(),
    }))
    .filter((item) => item.name && item.path)
    .reduce((acc: LocalModelEntry[], current) => {
      const exists = acc.some((entry) => entry.path === current.path || entry.name === current.name);
      if (!exists) {
        acc.push(current);
      }
      return acc;
    }, []);
}

async function readStorage(): Promise<Record<string, any>> {
  if (!storageApi?.local) {
    return {};
  }

  return await new Promise((resolve) => {
    storageApi.local.get('wa-settings', (data: Record<string, any> = {}) => resolve(data));
  });
}

async function writeStorage(next: Record<string, any>): Promise<void> {
  if (!storageApi?.local) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    storageApi.local.set({ 'wa-settings': next }, () => {
      const lastError = (globalThis as any).chrome?.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve();
    });
  });
}

export async function loadSettings(): Promise<Settings> {
  const stored = await readStorage();
  const saved = stored['wa-settings'] ?? {};
  const merged = {
    ...DEFAULT_SETTINGS,
    ...saved,
  };

  merged.localModelHistory = normalizeLocalModelHistory(saved.localModelHistory ?? DEFAULT_SETTINGS.localModelHistory);

  return merged;
}

export async function saveSettings(next: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const merged = {
    ...current,
    ...next,
  };

  if (Array.isArray(next.localModelHistory)) {
    merged.localModelHistory = normalizeLocalModelHistory(next.localModelHistory);
  }

  await writeStorage(merged);
  return merged;
}
