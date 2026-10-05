import type { ConnectionSettings, LocalModelConfig } from './connectionTypes';
import { LOCAL_MODEL_PREFERENCES } from './connectionTypes';

// Easy connection configuration for users
export const EASY_CONFIGURATIONS = {
  puter: {
    name: 'Puter Sign-In',
    provider: 'puter' as any,
    mode: 'local' as const,
    description: 'Web-based account with automatic connection',
    setupSteps: [
      'Click "Puter Sign-In" button',
      'Follow web browser authentication',
      'Allow browser permissions for auto-connection',
      'Connection established automatically'
    ]
  },
  
  apiKey: {
    name: 'API Key Connection',
    provider: 'openrouter',
    mode: 'remote' as const,
    description: 'Enter your API key from OpenRouter or OpenAI',
    setupSteps: [
      'Click "API Key" button',
      'Enter your API key in the password field',
      'Click "Connect with API Key"',
      'Connection established using your API key'
    ]
  },
  
  local: {
    name: 'Local Model',
    provider: 'local',
    mode: 'local' as const,
    description: 'Run AI locally on your device',
    setupSteps: [
      'Download recommended models (Qwen2.5 Coder, etc.)',
      'Ensure Ollama is running on local port 11434',
      'Extension will auto-detect local models',
      'Connection established automatically'
    ]
  },
  
  webgpu: {
    name: 'WebGPU Connection',
    provider: 'webgpu',
    mode: 'local' as const,
    description: 'Run AI in your browser using WebGPU',
    setupSteps: [
      'Enable WebGPU in browser settings',
      'Allow access to device GPU',
      'Extension will download lightweight model',
      'Connection established in-browser'
    ]
  }
};

// Default model configurations with download commands
export const DEFAULT_MODEL_DOWNLOADS = [
  {
    name: 'Qwen2.5 Coder',
    modelId: 'qwen2.5-coder',
    size: '5GB',
    downloadCommand: 'ollama pull qwen2.5-coder:latest',
    alternativeCommand: 'docker run -d -p 11434:11434 --gpus all -v ollama-data:/root/.ollama --name ollama ollama/ollama',
    required: true,
    reason: 'Primary choice for code generation and reasoning'
  },
  {
    name: 'Llama 3.2 1B',
    modelId: 'llama3.2:1b',
    size: '1GB',
    downloadCommand: 'ollama pull llama3.2:1b',
    alternativeCommand: 'docker run -d -p 11434:11434 --name ollama ollama/ollama',
    required: false,
    reason: 'Lightweight alternative for quick starts'
  },
  {
    name: 'Phi-3 Mini',
    modelId: 'phi3:mini',
    size: '1.5GB',
    downloadCommand: 'ollama pull phi3:mini',
    alternativeCommand: 'docker run -d -p 11434:11434 --name ollama ollama/ollama',
    required: false,
    reason: 'Good balance of size and performance'
  }
];

// Connection URL templates
export const CONNECTION_URLS = {
  ollama: 'http://localhost:11434',
  webgpu: 'ws://localhost:3000',
  puter: 'https://puter.com/api',
  openrouter: 'https://openrouter.ai/api/v1'
};

// Settings helper
export const createConnectionSettings = (config: ConnectionSettings): ConnectionSettings => ({
  ...config,
  autoConnect: false,
  lastConnection: new Date().toISOString()
});

// Model validation
export function validateLocalModelConfig(model: LocalModelConfig): { valid: boolean; error?: string } {
  if (!model.path || !model.name) {
    return { valid: false, error: 'Missing path or name' };
  }

  if (model.downloadConfig?.ollamaCommand) {
    if (!model.downloadConfig.ollamaCommand.includes('ollama pull')) {
      return { valid: false, error: 'Invalid Ollama command' };
    }
  }

  return { valid: true };
}
