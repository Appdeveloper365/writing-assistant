import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getOllamaStatus, isModelCached, ollamaSettings, pullModelWithProgress, warmChatModel } from './ollama.js';

const SETUP_INSTALL_TIMEOUT_MS = Number(process.env.OLLAMA_SETUP_INSTALL_TIMEOUT_MS || 15 * 60 * 1000) || 15 * 60 * 1000;
const SETUP_SERVICE_TIMEOUT_MS = Number(process.env.OLLAMA_SETUP_SERVICE_TIMEOUT_MS || 3 * 60 * 1000) || 3 * 60 * 1000;
const SETUP_POLL_INTERVAL_MS = 2000;

const state = {
  running: false,
  phase: 'idle',
  message: 'Idle.',
  percent: 0,
  model: '',
  error: null,
  startedAt: null,
  finishedAt: null,
};

let setupController = null;
let activeChild = null;

export function getSetupState() {
  return { ...state };
}

export function isSetupRunning() {
  return state.running;
}

function runCommand(command, args, { timeout = SETUP_INSTALL_TIMEOUT_MS, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('setup cancelled'));
      return;
    }

    let child;
    try {
      child = spawn(command, args, { windowsHide: true, shell: false });
      activeChild = child;
    } catch (err) {
      reject(err);
      return;
    }

    const onAbort = () => {
      try { child.kill(); } catch { /* ignore */ }
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    let output = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      reject(new Error(`${command} timed out after ${Math.round(timeout / 1000)}s`));
    }, timeout);

    child.stdout?.on('data', (chunk) => {
      output += String(chunk);
      if (output.length > 4000) output = output.slice(-4000);
    });
    child.stderr?.on('data', (chunk) => {
      output += String(chunk);
      if (output.length > 4000) output = output.slice(-4000);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (activeChild === child) activeChild = null;
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (activeChild === child) activeChild = null;
      if (code === 0) {
        resolve({ code, output });
      } else {
        reject(new Error(`${command} exited with code ${code}: ${output.slice(-500)}`));
      }
    });
  });
}

async function downloadFile(url, dest, onProgress, signal) {
  const response = await fetch(url, { signal, redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`download failed (HTTP ${response.status || 'unknown'})`);
  }

  const total = Number(response.headers.get('content-length')) || 0;
  const file = fs.createWriteStream(dest);
  const reader = response.body.getReader();
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      await new Promise((resolve, reject) => {
        file.write(value, (err) => (err ? reject(err) : resolve()));
      });
      if (typeof onProgress === 'function') {
        onProgress(total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0, received, total);
      }
    }
  } finally {
    await new Promise((resolve, reject) => {
      file.end((err) => (err ? reject(err) : resolve()));
    });
  }

  return dest;
}

function findOllamaBinary() {
  const paths = [];
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env.ProgramFiles || '';
    if (localAppData) paths.push(path.join(localAppData, 'Programs', 'Ollama', 'ollama.exe'));
    if (programFiles) paths.push(path.join(programFiles, 'Ollama', 'ollama.exe'));
  } else {
    paths.push('/usr/local/bin/ollama', '/opt/homebrew/bin/ollama');
  }
  for (const candidate of paths) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore and keep looking
    }
  }
  return null;
}

async function serviceIsUp(host, timeoutMs = 3000) {
  const data = await getOllamaStatus({ host, timeoutMs });
  return Boolean(data?.available);
}

async function waitForOllamaService(host, timeoutMs, signal) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error('setup cancelled');
    }
    try {
      if (await serviceIsUp(host)) {
        return true;
      }
    } catch {
      // keep polling until the deadline
    }
    await new Promise((resolve) => setTimeout(resolve, SETUP_POLL_INTERVAL_MS));
  }
  return false;
}

async function installOllamaWindows(signal) {
  if (process.platform !== 'win32') {
    throw new Error('automatic Ollama install is only supported on Windows; install it from https://ollama.com/download');
  }

  // Fast path: use winget when available (quiet, per-user, no elevation).
  state.message = 'Installing Ollama (winget)…';
  try {
    await runCommand('winget', [
      'install', '--id', 'Ollama.Ollama', '-e',
      '--scope', 'user', '--silent',
      '--accept-package-agreements', '--accept-source-agreements',
      '--disable-interactivity',
    ], { signal });
    return;
  } catch (wingetError) {
    if (signal?.aborted) throw new Error('setup cancelled');
    state.message = 'winget unavailable — downloading the Ollama installer…';
  }

  // Fallback: download the official installer and run it silently.
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-ollama-install-'));
  const installerPath = path.join(tempDir, 'OllamaSetup.exe');
  try {
    await downloadFile('https://ollama.com/download/OllamaSetup.exe', installerPath, (percent) => {
      state.percent = percent;
      state.message = `Downloading the Ollama installer… ${percent}%`;
    }, signal);

    state.percent = 0;
    state.message = 'Running the Ollama installer (silent)…';
    await runCommand(installerPath, ['/S'], { timeout: SETUP_INSTALL_TIMEOUT_MS, signal });
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

export function cancelEngineSetup() {
  try { setupController?.abort(); } catch { /* ignore */ }
  try {
    if (activeChild) {
      activeChild.kill();
      activeChild = null;
    }
  } catch { /* ignore */ }
  return getSetupState();
}

/**
 * Preset end-to-end setup: install Ollama when missing, wait for its service,
 * pull the gemma2:2b preset model with progress, then warm it into memory.
 * Everything runs inside the app — no CLI needed.
 */
export async function startEngineSetup(options = {}) {
  if (state.running) {
    return getSetupState();
  }

  const host = options.host ?? ollamaSettings.host;
  const model = options.model || ollamaSettings.generateModel;
  if (!model) {
    throw new Error('no engine model configured (set OLLAMA_GENERATE_MODEL)');
  }

  const controller = new AbortController();
  setupController = controller;
  Object.assign(state, {
    running: true,
    phase: 'checking',
    message: 'Checking for Ollama…',
    percent: 0,
    model,
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  });

  const signal = controller.signal;

  (async () => {
    try {
      let available = await serviceIsUp(host);
      if (signal.aborted) throw new Error('setup cancelled');

      if (!available) {
        state.phase = 'installing-ollama';
        await installOllamaWindows(signal);
        if (signal.aborted) throw new Error('setup cancelled');

        state.phase = 'waiting-for-service';
        state.message = 'Starting the Ollama service…';
        state.percent = 0;
        available = await waitForOllamaService(host, SETUP_SERVICE_TIMEOUT_MS, signal);
        if (signal.aborted) throw new Error('setup cancelled');
        if (!available) {
          throw new Error('Ollama was installed but its service did not start. Launch the Ollama app once, then try again.');
        }
      }

      state.phase = 'downloading-model';
      state.message = `Ollama with Gemma is downloading (${model})…`;
      state.percent = 0;
      await pullModelWithProgress(model, (update) => {
        if (signal.aborted) return;
        state.percent = update.percent;
        state.message = update.done
          ? `Ollama with Gemma finished downloading (${model}).`
          : `Ollama with Gemma is downloading (${model})… ${update.percent}%`;
      }, { host, signal });

      if (signal.aborted) throw new Error('setup cancelled');

      state.phase = 'warming';
      state.message = 'Loading Gemma into memory…';
      const warmed = await warmChatModel({ host, model });
      if (signal.aborted) throw new Error('setup cancelled');

      Object.assign(state, {
        running: false,
        phase: warmed ? 'ready' : 'ready-unwarmed',
        message: warmed
          ? `Ollama with Gemma is ready — ${model} is cached and loaded.`
          : `Ollama with Gemma downloaded (${model}); it will load on first use.`,
        percent: 100,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      const cancelled = signal.aborted || /cancelled/i.test(error?.message || '');
      Object.assign(state, {
        running: false,
        phase: cancelled ? 'cancelled' : 'error',
        error: cancelled ? null : (error instanceof Error ? error.message : String(error)),
        message: cancelled
          ? 'Setup stopped. Press Download to resume — partial downloads continue from where they stopped.'
          : `Setup failed: ${error instanceof Error ? error.message : String(error)}`,
        finishedAt: new Date().toISOString(),
      });
    } finally {
      if (setupController === controller) {
        setupController = null;
      }
    }
  })();

  return getSetupState();
}
