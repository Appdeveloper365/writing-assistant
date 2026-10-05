export type ConnectionProvider = 'local' | 'webgpu' | 'ollama' | 'openrouter' | 'openai' | 'azure-openai' | 'anthropic';

export interface ConnectionSettings {
  provider: ConnectionProvider;
  mode: 'local' | 'remote' | 'hybrid';
  apiKey?: string;
  apiBase?: string;
  model?: string;
  connectionUrl?: string;
  autoConnect?: boolean;
}

export interface LocalModelConfig {
  name: string;
  path: string;
  modelId: string;
  size?: string;
  downloadConfig?: DownloadConfig;
}

export interface DownloadConfig {
  ollamaCommand?: string;
  webgpuCommand?: string;
  dockerCommand?: string;
}

export type SignOnMethod = 'puter' | 'api_key' | 'browser_autodetect' | 'manual' | 'claude_auth' | 'cohere_auth';

export const SIGN_ON_METHODS: SignOnMethod[] = [
  'puter', // Web-based account
  'api_key', // Manual API key entry
  'browser_autodetect', // Browser API detection
  'manual', // Manual configuration
  'claude_auth', // Claude-specific auth
  'cohere_auth' // Cohere-specific auth
];

export const DEFAULT_CONNECTION_SETTINGS: ConnectionSettings = {
  provider: 'local',
  mode: 'local',
};

export const LOCAL_MODEL_PREFERENCES = [
  {
    name: 'Qwen2.5 Coder',
    modelId: 'qwen2.5-coder',
    size: '~5GB',
    downloadConfig: {
      ollamaCommand: 'ollama pull qwen2.5-coder:latest'
    },
    capabilities: ['chat', 'code', 'edit']
  },
  {
    name: 'Llama 3.2 1B',
    modelId: 'llama3.2:1b',
    size: '~1GB',
    downloadConfig: {
      ollamaCommand: 'ollama pull llama3.2:1b'
    },
    capabilities: ['chat', 'code']
  },
  {
    name: 'Phi-3 Mini',
    modelId: 'phi3:mini',
    size: '~1.5GB',
    downloadConfig: {
      ollamaCommand: 'ollama pull phi3:mini'
    },
    capabilities: ['chat', 'code']
  },
  {
    name: 'SmolLM 135M',
    modelId: 'smollm:135m',
    size: '~150MB',
    downloadConfig: {
      ollamaCommand: 'ollama pull smollm:135m'
    },
    capabilities: ['chat']
  }
];

export const OPENROUTER_MODEL_OPTIONS = [
  'openrouter/free', 'openrouter/gpt-4o-mini', 'openrouter/codellama:7b', 'openrouter/qwen2.5:7b'
];

export const SIGN_IN_OPTIONS = [
  {
    id: 'puter',
    name: 'Puter Sign-In',
    description: 'Easy web-based account with auto-connection',
    icon: '🌐',
    requires: ['puter-sdk']
  },
  {
    id: 'api_key',
    name: 'API Key',
    description: 'Enter your OpenRouter/OpenAI API key',
    icon: '🔑',
    requires: ['api-key-entry']
  },
  {
    id: 'browser_autodetect',
    name: 'Browser Autodetect',
    description: 'Auto-detect available local models',
    icon: '🔍',
    requires: ['ollama-api']
  },
  {
    id: 'manual',
    name: 'Manual Connection',
    description: 'Configure custom connection settings',
    icon: '⚙️',
    requires: ['custom-config']
  }
];
