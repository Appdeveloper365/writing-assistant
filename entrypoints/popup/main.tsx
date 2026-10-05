import React from 'react';
import ReactDOM from 'react-dom/client';
import { validateRemoteAiSettings, type LocalModelEntry } from '../../src/lib/settings';
import { cancelGatewayEngineSetup, downloadOllamaModel, fetchGatewayEngineSetup, fetchOllamaEngineStatus, isAutoDownloadEnabled, startGatewayEngineSetup, warmOllamaEngine, type EngineSetupState, type OllamaEngineStatus } from '../../src/lib/ollamaEngine';
import '../styles.css';

const tones = ['professional', 'casual', 'concise', 'creative'] as const;
type Tone = (typeof tones)[number];
type AiMode = 'local' | 'remote' | 'off';
type RemoteProvider = 'openai' | 'azure-openai' | 'anthropic' | 'openrouter';

const runtimeApi = (globalThis as any).browser ?? (globalThis as any).chrome;

async function sendBackgroundMessage(payload: Record<string, any>) {
  if (!runtimeApi?.runtime) {
    return null;
  }

  return await new Promise((resolve, reject) => {
    try {
      runtimeApi.runtime.sendMessage(payload, (response: any) => {
        const lastError = runtimeApi.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(response ?? null);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function App() {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [tone, setTone] = React.useState<Tone>('professional');
  const [aiMode, setAiMode] = React.useState<AiMode>('local');
  const [remoteProvider, setRemoteProvider] = React.useState<RemoteProvider>('openai');
  const [remoteModel, setRemoteModel] = React.useState('gpt-4o-mini');
  const [apiKey, setApiKey] = React.useState('');
  const [apiKeyDraft, setApiKeyDraft] = React.useState('');
  const [localAiEnabled, setLocalAiEnabled] = React.useState(false);
  const [localModelPath, setLocalModelPath] = React.useState('');
  const [localModelName, setLocalModelName] = React.useState('');
  const [localModelHistory, setLocalModelHistory] = React.useState<LocalModelEntry[]>([]);
  const [localPermissionGranted, setLocalPermissionGranted] = React.useState(false);
  const [cloudEnabled, setCloudEnabled] = React.useState(false);
  const [enabled, setEnabled] = React.useState(true);
  const [requireConfirmation, setRequireConfirmation] = React.useState(true);
  const [showPreview, setShowPreview] = React.useState(true);
  const [ollamaStatus, setOllamaStatus] = React.useState<OllamaEngineStatus | null>(null);
  const [ollamaBusy, setOllamaBusy] = React.useState<'check' | 'warm' | null>(null);
  const [ollamaDownloading, setOllamaDownloading] = React.useState(false);
  const [ollamaProgress, setOllamaProgress] = React.useState(0);
  const [ollamaDownloadStatus, setOllamaDownloadStatus] = React.useState('');
  const ollamaAbortRef = React.useRef<AbortController | null>(null);
  const ollamaDownloadStartedRef = React.useRef(false);
  const [gatewaySetup, setGatewaySetup] = React.useState<EngineSetupState | null>(null);
  const [gatewaySetupBusy, setGatewaySetupBusy] = React.useState(false);
  const gatewaySetupPollingRef = React.useRef(false);

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await sendBackgroundMessage({ type: 'GET_SETTINGS' });
        if (!response) return;

        const history = Array.isArray(response.localModelHistory) ? response.localModelHistory as LocalModelEntry[] : [];
        const selectedName = String(response.localModelName ?? '').trim();
        const selectedPath = String(response.localModelPath ?? '').trim();

        setTone(response.tone ?? 'professional');
        setAiMode((response.aiMode ?? 'local') as AiMode);
        setRemoteProvider((response.remoteProvider ?? 'openai') as RemoteProvider);
        setRemoteModel((response.remoteModel ?? 'gpt-4o-mini') as string);
        setApiKey(response.apiKey ?? '');
        setApiKeyDraft(response.apiKey ?? '');
        setCloudEnabled(Boolean(response.cloudRewriteEnabled));
        setEnabled(Boolean(response.suggestionsEnabled));
        setRequireConfirmation(Boolean(response.requireConfirmation ?? true));
        setShowPreview(Boolean(response.showPreview ?? true));
        setLocalModelHistory(history);
        setLocalModelName(selectedName || history[0]?.name || '');
        setLocalModelPath(selectedPath || history[0]?.path || '');
        setLocalPermissionGranted(Boolean(response.localPermissionGranted || Boolean(selectedName || selectedPath) || history.length > 0));
        setLocalAiEnabled(Boolean(response.localAiEnabled || Boolean(selectedName || selectedPath) || history.length > 0));
      } catch {
        // ignore and keep defaults
      }
    };

    fetchSettings();
  }, []);

  const saveSettings = async (
    nextTone: Tone,
    nextAiMode: AiMode,
    nextRemoteProvider: RemoteProvider,
    nextRemoteModelValue: string,
    nextApiKey: string,
    nextLocalAiEnabled: boolean,
    nextLocalModelPath: string,
    nextLocalModelNameValue: string,
    nextLocalPermissionGranted: boolean,
    nextLocalModelHistoryValue: LocalModelEntry[],
    nextCloud: boolean,
    nextEnabled: boolean,
    nextRequireConfirmation: boolean,
    nextShowPreview: boolean,
  ) => {
    const settings = {
      tone: nextTone,
      aiMode: nextAiMode,
      remoteProvider: nextRemoteProvider,
      remoteModel: nextRemoteModelValue,
      apiKey: nextApiKey,
      localAiEnabled: nextLocalAiEnabled,
      localModelPath: nextLocalModelPath,
      localModelName: nextLocalModelNameValue,
      localModelHistory: nextLocalModelHistoryValue,
      localPermissionGranted: nextLocalPermissionGranted,
      cloudRewriteEnabled: nextCloud,
      suggestionsEnabled: nextEnabled,
      requireConfirmation: nextRequireConfirmation,
      showPreview: nextShowPreview,
    };

    try {
      await sendBackgroundMessage({ type: 'SAVE_SETTINGS', settings });
    } catch {
      // keep the UI responsive even if storage fails
    }
  };

  const checkOllamaEngine = async (kind: 'check' | 'warm' = 'check') => {
    setOllamaBusy(kind);
    try {
      const status = kind === 'warm' ? await warmOllamaEngine() : await fetchOllamaEngineStatus();
      setOllamaStatus(status);
    } finally {
      setOllamaBusy(null);
    }
  };

  const startOllamaDownload = async () => {
    if (ollamaDownloadStartedRef.current) {
      return;
    }
    ollamaDownloadStartedRef.current = true;
    const controller = new AbortController();
    ollamaAbortRef.current = controller;
    setOllamaDownloading(true);
    setOllamaProgress(0);
    setOllamaDownloadStatus('Starting download…');

    try {
      const status = await downloadOllamaModel((update) => {
        setOllamaProgress(update.percent);
        setOllamaDownloadStatus(update.status);
      }, { signal: controller.signal });
      setOllamaStatus(status);
    } finally {
      ollamaDownloadStartedRef.current = false;
      ollamaAbortRef.current = null;
      setOllamaDownloading(false);
    }
  };

  const stopOllamaDownload = () => {
    ollamaAbortRef.current?.abort();
    ollamaAbortRef.current = null;
    ollamaDownloadStartedRef.current = false;
    setOllamaDownloading(false);
  };

  const pollGatewaySetup = async () => {
    if (gatewaySetupPollingRef.current) {
      return;
    }
    gatewaySetupPollingRef.current = true;
    try {
      // Keep polling while the gateway-owned setup is active.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const current = await fetchGatewayEngineSetup();
        if (!current) {
          break;
        }
        setGatewaySetup(current);
        if (!current.running) {
          // Engine settled (ready/error) — resync the cached-engine status line.
          const status = await fetchOllamaEngineStatus();
          setOllamaStatus(status);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } finally {
      gatewaySetupPollingRef.current = false;
    }
  };

  const stopGatewaySetup = async () => {
    const stopped = await cancelGatewayEngineSetup();
    if (stopped) {
      setGatewaySetup(stopped);
    }
    setGatewaySetupBusy(false);
  };

  const engineNeedsDownload = !ollamaStatus || !ollamaStatus.available || !ollamaStatus.modelCached;

  const handleEngineDownload = async () => {
    if (!engineNeedsDownload) {
      await checkOllamaEngine('warm');
      return;
    }

    setGatewaySetupBusy(true);
    try {
      // Prefer the gateway-managed preset setup: it installs Ollama when the
      // service is missing, then downloads gemma2:2b and warms it — under one label.
      const started = await startGatewayEngineSetup();
      if (started) {
        setGatewaySetup(started);
        await pollGatewaySetup();
        return;
      }

      // Gateway unreachable: fall back to pulling the model straight into an
      // already-running Ollama (or refresh the status line if Ollama is missing).
      if (ollamaStatus?.available) {
        await startOllamaDownload();
      } else {
        setOllamaStatus(await fetchOllamaEngineStatus());
      }
    } finally {
      setGatewaySetupBusy(false);
    }
  };

  React.useEffect(() => {
    if (aiMode !== 'local') {
      return;
    }

    let cancelled = false;
    (async () => {
      const status = await fetchOllamaEngineStatus();
      if (cancelled) {
        return;
      }
      setOllamaStatus(status);

      // First use: Ollama is running but the engine model is not cached yet —
      // download it right away so the AI engine becomes ready for the user.
      if (status.available && !status.modelCached && isAutoDownloadEnabled()) {
        void handleEngineDownload();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [aiMode]);

  const remoteValidation = validateRemoteAiSettings({ aiMode, remoteProvider, apiKey });

  const saveRemoteAiSettings = async () => {
    const nextApiKey = apiKeyDraft.trim();
    setApiKey(nextApiKey);
    await saveSettings(tone, aiMode, remoteProvider, remoteModel, nextApiKey, localAiEnabled, localModelPath, localModelName, localPermissionGranted, localModelHistory, cloudEnabled, enabled, requireConfirmation, showPreview);
  };

  const handleTone = async (nextTone: Tone) => {
    setTone(nextTone);
    await saveSettings(nextTone, aiMode, remoteProvider, remoteModel, apiKey, localAiEnabled, localModelPath, localModelName, localPermissionGranted, localModelHistory, cloudEnabled, enabled, requireConfirmation, showPreview);
  };

  const handleAiMode = async (nextMode: AiMode) => {
    const nextApiKey = (apiKeyDraft || apiKey).trim();
    const shouldEnableLocal = nextMode === 'local' && (localAiEnabled || localPermissionGranted || localModelHistory.length > 0);
    const nextLocalPermission = nextMode === 'local' ? (localPermissionGranted || localModelHistory.length > 0) : localPermissionGranted;
    setAiMode(nextMode);
    setLocalAiEnabled(shouldEnableLocal);
    setLocalPermissionGranted(nextLocalPermission);
    setApiKey(nextApiKey);
    setApiKeyDraft(nextApiKey);
    await saveSettings(tone, nextMode, remoteProvider, remoteModel, nextApiKey, shouldEnableLocal, localModelPath, localModelName, nextLocalPermission, localModelHistory, cloudEnabled, enabled, requireConfirmation, showPreview);
  };

  const handleRemoteProvider = async (nextProvider: RemoteProvider) => {
    const nextModel = nextProvider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';
    setRemoteProvider(nextProvider);
    setRemoteModel(nextModel);
    await saveSettings(tone, aiMode, nextProvider, nextModel, apiKey, localAiEnabled, localModelPath, localModelName, localPermissionGranted, localModelHistory, cloudEnabled, enabled, requireConfirmation, showPreview);
  };

  const handleRemoteModel = async (nextModel: string) => {
    const trimmed = nextModel.trim() || 'gpt-4o-mini';
    setRemoteModel(trimmed);
    await saveSettings(tone, aiMode, remoteProvider, trimmed, apiKey, localAiEnabled, localModelPath, localModelName, localPermissionGranted, localModelHistory, cloudEnabled, enabled, requireConfirmation, showPreview);
  };

  const handleApiKey = async (nextKey: string) => {
    setApiKeyDraft(nextKey);
  };

  const addLocalModelCandidate = (candidateName: string, candidatePath: string) => {
    const deduped = [{ name: candidateName, path: candidatePath }, ...localModelHistory]
      .filter((item) => item.name && item.path)
      .reduce((acc: LocalModelEntry[], current) => {
        const exists = acc.some((entry) => entry.path === current.path || entry.name === current.name);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);

    setLocalModelHistory(deduped.slice(0, 5));
    setLocalModelName(candidateName);
    setLocalModelPath(candidatePath);
    setLocalPermissionGranted(true);
    setLocalAiEnabled(true);
    return deduped.slice(0, 5);
  };

  const handleLocalPermissionToggle = async (checked: boolean) => {
    setLocalAiEnabled(checked);
    if (!checked) {
      setLocalPermissionGranted(false);
    }
    await saveSettings(tone, aiMode, remoteProvider, remoteModel, apiKey, checked, localModelPath, localModelName, checked ? localPermissionGranted : false, localModelHistory, cloudEnabled, enabled, requireConfirmation, showPreview);
  };

  const handleLocalModelSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const candidateName = file.name || 'local-model';
    const candidatePath = file.name || 'local-model';
    const nextHistory = addLocalModelCandidate(candidateName, candidatePath);

    await saveSettings(
      tone,
      aiMode,
      remoteProvider,
      remoteModel,
      apiKey,
      true,
      candidatePath,
      candidateName,
      true,
      nextHistory,
      cloudEnabled,
      enabled,
      requireConfirmation,
      showPreview,
    );

    event.target.value = '';
  };

  const handleLocalModelChoice = async (nextName: string) => {
    const match = localModelHistory.find((entry) => entry.name === nextName);
    if (!match) {
      return;
    }

    setLocalModelName(match.name);
    setLocalModelPath(match.path);
    setLocalPermissionGranted(true);
    setLocalAiEnabled(true);
    await saveSettings(tone, aiMode, remoteProvider, remoteModel, apiKey, true, match.path, match.name, true, localModelHistory, cloudEnabled, enabled, requireConfirmation, showPreview);
  };

  const handleCloud = async (checked: boolean) => {
    setCloudEnabled(checked);
    await saveSettings(tone, aiMode, remoteProvider, remoteModel, apiKey, localAiEnabled, localModelPath, localModelName, localPermissionGranted, localModelHistory, checked, enabled, requireConfirmation, showPreview);
  };

  const handleSuggestions = async (checked: boolean) => {
    setEnabled(checked);
    await saveSettings(tone, aiMode, remoteProvider, remoteModel, apiKey, localAiEnabled, localModelPath, localModelName, localPermissionGranted, localModelHistory, cloudEnabled, checked, requireConfirmation, showPreview);
  };

  const handleRequireConfirmation = async (checked: boolean) => {
    setRequireConfirmation(checked);
    await saveSettings(tone, aiMode, remoteProvider, remoteModel, apiKey, localAiEnabled, localModelPath, localModelName, localPermissionGranted, localModelHistory, cloudEnabled, enabled, checked, showPreview);
  };

  const handleShowPreview = async (checked: boolean) => {
    setShowPreview(checked);
    await saveSettings(tone, aiMode, remoteProvider, remoteModel, apiKey, localAiEnabled, localModelPath, localModelName, localPermissionGranted, localModelHistory, cloudEnabled, enabled, requireConfirmation, checked);
  };

  const localStatusLabel = localModelHistory.length > 0 ? 'Auto-detected local AI model' : 'No local AI model found';
  const localStatusDescription = localModelHistory.length > 0
    ? `${localModelName || localModelHistory[0].name} is available for Local AI.`
    : 'Select a model file to enable Local AI. The extension will remember it for future sessions.';

  const ollamaStatusLabel = ollamaStatus?.available && ollamaStatus.modelCached
    ? 'Ollama engine ready'
    : ollamaStatus?.available
      ? 'Ollama detected — model not cached'
      : 'Ollama engine not detected';

  return (
    <main className="wa-popup">
      <div className="wa-popup-card">
        <div className="wa-title-block">
          <div className="wa-brand-mark">✎</div>
          <div>
            <h1>Smart Paraphraser</h1>
            <p>Choose how your AI rewrite runs.</p>
          </div>
        </div>

        <div className="wa-section">
          <label className="wa-section-label">Rewrite engine</label>
          <div className="wa-mode-grid">
            <button type="button" className={aiMode === 'local' ? 'selected' : ''} onClick={() => handleAiMode('local')}>
              Local AI
            </button>
            <button type="button" className={aiMode === 'remote' ? 'selected' : ''} onClick={() => handleAiMode('remote')}>
              Remote AI
            </button>
            <button type="button" className={aiMode === 'off' ? 'selected' : ''} onClick={() => handleAiMode('off')}>
              Off
            </button>
          </div>
          <p className="wa-small-copy">
            Local AI runs on this device. Remote AI uses your own API subscription and you pay the provider directly.
          </p>
        </div>

        {aiMode === 'local' && (
          <div className="wa-section wa-remote-panel">
            <label className="wa-section-label">Local AI model</label>
            <label className="wa-toggle">
              <input type="checkbox" checked={localAiEnabled} onChange={(event) => handleLocalPermissionToggle(event.target.checked)} />
              <span>Use local AI model</span>
            </label>

            {localModelHistory.length > 0 ? (
              <>
                <label className="wa-field-label" htmlFor="local-model-select">Detected model</label>
                <select id="local-model-select" value={localModelName || localModelHistory[0].name} onChange={(event) => handleLocalModelChoice(event.target.value)}>
                  {localModelHistory.map((entry) => (
                    <option key={`${entry.name}-${entry.path}`} value={entry.name}>{entry.name}</option>
                  ))}
                </select>
              </>
            ) : (
              <div className="wa-remote-status warning">
                <strong>No local AI model found</strong>
                <span>Select a model file to enable Local AI and keep it available for future sessions.</span>
              </div>
            )}

            <button type="button" className="wa-action-button" onClick={() => fileInputRef.current?.click()}>
              Select local model file
            </button>
            <input ref={fileInputRef} type="file" accept=".onnx,.gguf,.bin,.json,.txt,.model" style={{ display: 'none' }} onChange={handleLocalModelSelected} />

            <div className={localModelHistory.length > 0 ? 'wa-remote-status ok' : 'wa-remote-status warning'}>
              <strong>{localStatusLabel}</strong>
              <span>{localStatusDescription}</span>
            </div>

            <label className="wa-section-label">Ollama cached engine</label>
            <div className={ollamaStatus?.available && ollamaStatus.modelCached ? 'wa-remote-status ok' : 'wa-remote-status warning'}>
              <strong>{ollamaStatusLabel}</strong>
              <span>{ollamaStatus?.message ?? 'Checking the local Ollama engine…'}</span>
            </div>

            {ollamaDownloading && (
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ height: 8, background: 'rgba(148, 163, 184, 0.35)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${ollamaProgress}%`, background: '#2563eb', borderRadius: 999, transition: 'width 200ms ease' }} />
                </div>
                <span className="wa-small-copy" style={{ margin: 0 }}>
                  Downloading {ollamaStatus?.model ?? 'engine model'} — {ollamaProgress}% ({ollamaDownloadStatus}). Keep this popup open.
                </span>
              </div>
            )}

            {gatewaySetup?.running && (
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ height: 8, background: 'rgba(148, 163, 184, 0.35)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, gatewaySetup.percent))}%`, background: '#2563eb', borderRadius: 999, transition: 'width 200ms ease' }} />
                </div>
                <span className="wa-small-copy" style={{ margin: 0 }}>
                  Ollama with Gemma is downloading — {Math.max(0, Math.min(100, Math.round(gatewaySetup.percent)))}% ({gatewaySetup.message}). Keep this popup open.
                </span>
              </div>
            )}

            {!gatewaySetup?.running && gatewaySetup && ['error', 'cancelled'].includes(gatewaySetup.phase) && (
              <div className="wa-remote-status warning">
                <strong>Engine setup needs attention</strong>
                <span>{gatewaySetup.message}</span>
              </div>
            )}

            <div className="wa-mode-grid">
              <button type="button" className="wa-action-button" onClick={() => void checkOllamaEngine('check')} disabled={ollamaBusy !== null || ollamaDownloading || gatewaySetupBusy}>
                {ollamaBusy === 'check' ? 'Checking…' : 'Check engine'}
              </button>
              {gatewaySetup?.running ? (
                <button type="button" className="wa-action-button" onClick={() => void stopGatewaySetup()}>
                  Stop download
                </button>
              ) : ollamaDownloading ? (
                <button type="button" className="wa-action-button" onClick={stopOllamaDownload}>
                  Stop download
                </button>
              ) : (
                <button
                  type="button"
                  className="wa-action-button"
                  onClick={() => void handleEngineDownload()}
                  disabled={ollamaBusy !== null || gatewaySetupBusy}
                >
                  {ollamaBusy === 'warm'
                    ? 'Warming…'
                    : gatewaySetupBusy
                      ? 'Downloading…'
                      : engineNeedsDownload
                        ? 'Download Ollama + Gemma'
                        : 'Warm up engine'}
                </button>
              )}
            </div>

            {ollamaStatus && (
              <p className="wa-small-copy">
                {ollamaStatus.model} @ {ollamaStatus.host} — press Download and everything (Ollama + Gemma) installs internally.
              </p>
            )}
          </div>
        )}

        {aiMode === 'remote' && (
          <div className="wa-section wa-remote-panel">
            <label className="wa-field-label" htmlFor="provider-select">Provider</label>
            <select id="provider-select" value={remoteProvider} onChange={(event) => handleRemoteProvider(event.target.value as RemoteProvider)}>
              <option value="openai">OpenAI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="azure-openai">Azure OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>

            <label className="wa-field-label" htmlFor="api-key-input">API key</label>
            <input
              id="api-key-input"
              type="password"
              value={apiKeyDraft}
              placeholder={`Paste your ${remoteValidation.providerLabel} API key`}
              onChange={(event) => handleApiKey(event.target.value)}
            />

            <button type="button" className="wa-action-button" onClick={saveRemoteAiSettings}>
              Save remote AI settings
            </button>

            <label className="wa-field-label" htmlFor="model-input">Model</label>
            <input
              id="model-input"
              type="text"
              value={remoteModel}
              placeholder={remoteProvider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'}
              onChange={(event) => handleRemoteModel(event.target.value)}
            />

            <div className={remoteValidation.valid ? 'wa-remote-status ok' : 'wa-remote-status warning'}>
              <strong>{remoteValidation.valid ? 'Remote AI is ready' : 'Remote AI needs a key'}</strong>
              <span>{remoteValidation.message}</span>
            </div>
          </div>
        )}

        <div className="wa-section">
          <label className="wa-section-label">Default tone</label>
          <div className="wa-grid">
            {tones.map((option) => (
              <button
                key={option}
                type="button"
                className={tone === option ? 'selected' : ''}
                onClick={() => handleTone(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="wa-section wa-toggle-stack">
          <label className="wa-toggle">
            <input type="checkbox" checked={enabled} onChange={(event) => handleSuggestions(event.target.checked)} />
            <span>Suggestions enabled</span>
          </label>

          <label className="wa-toggle">
            <input type="checkbox" checked={requireConfirmation} onChange={(event) => handleRequireConfirmation(event.target.checked)} />
            <span>Require confirmation before apply</span>
          </label>

          <label className="wa-toggle">
            <input type="checkbox" checked={showPreview} onChange={(event) => handleShowPreview(event.target.checked)} />
            <span>Show rewrite preview</span>
          </label>
        </div>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
