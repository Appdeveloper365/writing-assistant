import type { ConnectionSettings, LocalModelConfig, SignOnMethod } from './connectionTypes';

const storageApi = (globalThis as any).browser?.storage ?? (globalThis as any).chrome?.storage;

// Connection state management
interface ConnectionState {
  settings: ConnectionSettings;
  signOnMethod: SignOnMethod;
  modelsDownloaded: string[];
  autoConnectEnabled: boolean;
  lastConnectionTime?: string;
}

const DEFAULT_STATE: ConnectionState = {
  settings: {
    provider: 'local',
    mode: 'local',
  },
  signOnMethod: 'manual',
  modelsDownloaded: [],
  autoConnectEnabled: false,
};

export class ConnectionManager {
  private static instance: ConnectionManager;

  static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  private state: ConnectionState = { ...DEFAULT_STATE };

  async init(): Promise<void> {
    const stored = await this.loadState();
    this.state = { ...DEFAULT_STATE, ...stored };
  }

  private async loadState(): Promise<ConnectionState> {
    if (!storageApi?.local) {
      return { ...DEFAULT_STATE };
    }

    return new Promise((resolve) => {
      storageApi.local.get('quizmaster-connection', (data: any = {}) => {
        resolve(data['quizmaster-connection'] ?? { ...DEFAULT_STATE });
      });
    });
  }

  private async saveState(): Promise<void> {
    if (!storageApi?.local) {
      return;
    }

    await new Promise<void>((resolve) => {
      storageApi.local.set({ 
        'quizmaster-connection': this.state 
      }, () => {
        resolve();
      });
    });
  }

  // Connection management
  async connect(provider: ConnectionSettings): Promise<boolean> {
    this.state.settings = provider;
    this.state.lastConnectionTime = new Date().toISOString();
    await this.saveState();
    return true;
  }

  async disconnect(): Promise<boolean> {
    this.state.settings = {
      provider: 'local',
      mode: 'local',
    };
    await this.saveState();
    return true;
  }

  getSettings(): ConnectionSettings {
    return this.state.settings;
  }

  getSignOnMethod(): SignOnMethod {
    return this.state.signOnMethod;
  }

  async setSignOnMethod(method: SignOnMethod): Promise<void> {
    this.state.signOnMethod = method;
    await this.saveState();
  }

  // Model management
  async markModelDownloaded(modelId: string): Promise<void> {
    if (!this.state.modelsDownloaded.includes(modelId)) {
      this.state.modelsDownloaded.push(modelId);
      await this.saveState();
    }
  }

  isModelDownloaded(modelId: string): boolean {
    return this.state.modelsDownloaded.includes(modelId);
  }

  getDownloadedModels(): string[] {
    return this.state.modelsDownloaded;
  }

  // Auto-connection
  async setAutoConnect(enabled: boolean): Promise<void> {
    this.state.autoConnectEnabled = enabled;
    await this.saveState();
  }

  isAutoConnectEnabled(): boolean {
    return this.state.autoConnectEnabled;
  }

  // Connection status
  isConnected(): boolean {
    return this.state.settings.mode !== 'off';
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'error' {
    if (!this.isConnected()) {
      return 'disconnected';
    }

    if (this.state.settings.provider === 'local' || 
        this.state.settings.provider === 'webgpu') {
      return 'connected';
    }

    if (!this.state.settings.apiKey) {
      return 'error';
    }

    return 'connected';
  }
}

export const connectionManager = ConnectionManager.getInstance();
