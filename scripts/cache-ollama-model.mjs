#!/usr/bin/env node
import { ensureModelReady, getOllamaSettings } from '../api-gateway/ollama.js';

// Optional: override the generative model, e.g.
//   npm run ai:warm qwen2.5:1.5b
//   npm run ai:warm gemma2:2b
const modelOverride = (process.argv[2] || '').trim();

const settings = getOllamaSettings();
if (modelOverride) {
  settings.generateModel = modelOverride;
}

console.log('Smart Paraphraser — cached AI engine setup');
console.log(`  Ollama host     : ${settings.host}`);
console.log(`  Engine model    : ${settings.generateModel || '(disabled)'}`);
console.log(`  Embedding model : ${settings.embedModel || '(disabled — fuzzy cache only)'}`);
console.log('');

const result = await ensureModelReady({
  generateModel: settings.generateModel,
  embedModel: settings.embedModel,
  log: (message) => console.log(message),
});

if (result.ready) {
  console.log('');
  console.log(`AI engine is ready for users: ${result.model}`);
  console.log(
    result.warmed
      ? 'The model is loaded in memory (warm), so the first rewrite request is instant.'
      : 'The model is cached on disk; it will load on first use.',
  );
  console.log('Low-memory alternatives: qwen2.5:0.5b (~400 MB), qwen2.5:1.5b (~1.1 GB).');
  process.exit(0);
}

console.log('');
switch (result.reason) {
  case 'ollama-unavailable':
    console.log('Ollama is not running (or not installed).');
    console.log('Install it from https://ollama.com, start it, then re-run: npm run ai:warm');
    break;
  case 'no-model-configured':
    console.log('No Ollama model configured. Set OLLAMA_GENERATE_MODEL (default: gemma2:2b).');
    break;
  case 'model-not-cached':
    console.log(`The model ${result.model} is not cached and automatic pull is disabled (OLLAMA_PULL_IF_MISSING=false).`);
    console.log(`Run: ollama pull ${result.model}`);
    break;
  case 'pull-failed':
    console.log(`Failed to pull ${result.model}. Check disk space and network, then re-run: npm run ai:warm`);
    break;
  default:
    console.log(`The AI engine could not be prepared (reason: ${result.reason ?? 'unknown'}).`);
}

process.exit(1);