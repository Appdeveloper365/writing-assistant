import React, { useState, useEffect } from 'react';
import { ConnectionManager } from '../lib/connectionManager';
import type { ConnectionSettings, LocalModelConfig, SignOnMethod } from '../lib/connectionTypes';

export function ConnectionUI() {
  const [settings, setSettings] = useState<ConnectionSettings>({ provider: 'local', mode: 'local' });
  const [signOnMethod, setSignOnMethod] = useState<SignOnMethod>('manual');
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [models, setModels] = useState<LocalModelConfig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadConnectionSettings();
  }, []);

  const loadConnectionSettings = async () => {
    const manager = ConnectionManager.getInstance();
    await manager.init();
    const currentSettings = manager.getSettings();
    setSettings(currentSettings);
    setModels(manager.getDownloadedModels());
  };

  const handleConnect = async (provider: ConnectionSettings) => {
    const manager = ConnectionManager.getInstance();
    await manager.connect(provider);
    setSettings(provider);
  };

  const handleApiConnect = async () => {
    if (!apiKey.trim()) {
      alert('Please enter your API key');
      return;
    }

    const manager = ConnectionManager.getInstance();
    await manager.setSignOnMethod('api_key');
    await handleConnect({
      provider: 'openrouter',
      mode: 'remote',
      apiKey: apiKey.trim(),
    });
    setShowSettings(false);
  };

  const handleManualConnect = async () => {
    setSettings({
      provider: 'local',
      mode: 'local',
    });
    setShowSettings(false);
  };

  const handleModelDownload = async (model: LocalModelConfig) => {
    if (model.downloadConfig?.ollamaCommand) {
      const success = await runCommand(model.downloadConfig.ollamaCommand);
      if (success) {
        const manager = ConnectionManager.getInstance();
        await manager.markModelDownloaded(model.modelId);
        setModels([...models, model]);
        alert(`Successfully downloaded ${model.name}!`);
      }
    }
  };

  const runCommand = (command: string): Promise<boolean> => {
    // This would execute the command in a real implementation
    return new Promise((resolve) => {
      console.log('Executing command:', command);
      resolve(true); // Simplified for demo
    });
  };

  return (
    <div style={{ minWidth: 320, padding: 16, fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0, margin: 0 }}>Quiz Master Connection</h2>
        <div style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: settings.mode === 'local' ? '#4CAF50' : '#FF9800',
          color: 'white'
        }}>
          {settings.mode === 'local' ? 'Local Mode' : 'Remote Mode'}
        </div>
      </div>

      {/* Connection Status */}
      <div style={{ 
        padding: '12px', 
        margin: '8px 0',
        borderRadius: '8px',
        backgroundColor: settings.isConnected() ? '#E8F5E9' : '#FFEBEE'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: settings.isConnected() ? '#4CAF50' : '#F44336'
          }} />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
              {settings.isConnected() ? 'Connected' : 'Not Connected'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {settings.provider === 'local' ? 'Local AI' : 'Remote AI'}
            </div>
          </div>
        </div>
      </div>

      {/* Sign In Options */}
      <div style={{ marginTop: '16px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Choose Sign-In Method</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setSignOnMethod('puter');
              handleConnect({ provider: 'local', mode: 'local' });
            }}
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '20px' }}>🌐</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold' }}>Puter Sign-In</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Easy web-based account with auto-connection</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setApiKey('')}
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '20px' }}>🔑</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold' }}>API Key</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Enter your OpenRouter/OpenAI API key</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleManualConnect()}
            style={{
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '20px' }}>⚙️</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 'bold' }}>Manual Connection</div>
              <div style={{ fontSize: '12px', color: '#666' }}>Configure custom connection settings</div>
            </div>
          </button>
        </div>
      </div>

      {/* API Key Input */}
      {signOnMethod === 'api_key' && (
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: '#FFF3E0',
          border: '1px solid #FFE0B2'
        }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>
            Enter your API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-..."
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              marginBottom: '12px'
            }}
          />
          <button
            onClick={handleApiConnect}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Connect with API Key
          </button>
        </div>
      )}

      {/* Available Models */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '16px', margin: 0 }}>Downloaded Models</h3>
          <button
            onClick={() => {
              setModels(LOCAL_MODEL_PREFERENCES);
              loadConnectionSettings();
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Refresh
          </button>
        </div>

        {models.length === 0 && (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            backgroundColor: '#F5F5F5',
            borderRadius: '8px',
            color: '#666'
          }}>
            No models downloaded yet. Download recommended models below.
          </div>
        )}

        {models.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {models.map((model) => (
              <div
                key={model.modelId}
                style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: '#E8F5E9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{model.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{model.size}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleModelDownload(model)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Reinstall
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-Connect Toggle */}
      <div style={{ marginTop: '24px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.autoConnectEnabled}
            onChange={(e) => {
              // Implement auto-connect logic
              console.log('Auto-connect:', e.target.checked);
            }}
          />
          <span>Auto-connect on startup</span>
        </label>
      </div>
    </div>
  );
}

const LOCAL_MODEL_PREFERENCES = [
  {
    name: 'Qwen2.5 Coder',
    modelId: 'qwen2.5-coder',
    size: '~5GB',
    downloadConfig: { ollamaCommand: 'ollama pull qwen2.5-coder:latest' }
  },
  {
    name: 'Llama 3.2 1B',
    modelId: 'llama3.2:1b',
    size: '~1GB',
    downloadConfig: { ollamaCommand: 'ollama pull llama3.2:1b' }
  }
] as const;
