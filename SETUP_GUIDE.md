# Quiz Master Connection Setup Guide

This guide helps users set up easy connections for Quiz Master.

## Quick Start Options

### Option 1: Puter Sign-In (Recommended)
- **Best for**: Users who want easy web-based authentication
- **Setup Time**: 30 seconds
- **Connection**: Automatic

**Steps:**
1. Click "Puter Sign-In" button in settings
2. Use web browser authentication
3. Allow browser permissions for auto-connection
4. Connection established automatically

### Option 2: API Key Entry
- **Best for**: Users with existing API keys
- **Setup Time**: 1 minute
- **Connection**: Manual

**Steps:**
1. Click "API Key" button
2. Enter your API key (e.g., from OpenRouter)
3. Click "Connect with API Key"
4. Connection established

### Option 3: Local Model (Ollama)
- **Best for**: Privacy-focused users
- **Setup Time**: 5-10 minutes (first download)
- **Connection**: Automatic

**Steps:**
1. Ensure Ollama is running: `ollama serve`
2. Click "Download Models" button
3. Select recommended models (Qwen2.5 Coder)
4. Wait for download to complete
5. Connection established automatically

### Option 4: WebGPU (Browser-based)
- **Best for**: Browser-only users
- **Setup Time**: 2 minutes
- **Connection**: In-browser

**Steps:**
1. Enable WebGPU in browser settings
2. Click "WebGPU Connection"
3. Allow GPU access
4. Light model downloads in browser
5. Connection established

## Recommended Model Configuration

### Primary Model (Always Available)
**Qwen2.5 Coder** (~5GB)
- Download command: `ollama pull qwen2.5-coder:latest`
- Purpose: Main AI inference
- Features: Code generation, reasoning, best performance

### Alternative Models (Optional)
**Llama 3.2 1B** (~1GB)
- Download command: `ollama pull llama3.2:1b`
- Purpose: Quick starts, light usage
- Features: Fast loading, basic capabilities

**Phi-3 Mini** (~1.5GB)
- Download command: `ollama pull phi3:mini`
- Purpose: Balanced performance
- Features: Good for general tasks

## Auto-Connect Feature
Enable auto-connect on startup for seamless experience:
- Checked by default
- Automatic connection when app launches
- Saves connection state between sessions

## Troubleshooting

### Ollama Not Running
**Solution:** Start Ollama server
```bash
# Terminal command
ollama serve

# Docker alternative
docker run -d -p 11434:11434 --gpus all -v ollama-data:/root/.ollama --name ollama ollama/ollama
```

### API Key Not Working
**Solution:** Verify API key format
- Use OpenRouter API key (starts with `sk-or-`)
- Check for typos
- Ensure API key is valid

### WebGPU Not Supported
**Solution:** Enable WebGPU in browser
- Chrome: Settings → System → Graphics → Hardware acceleration
- Check GPU compatibility
- Update browser to latest version

## Connection Verification
- Check connection status indicator (green = connected)
- Test with a quick quiz generation
- Verify model response quality

## Privacy Considerations
- Local models: All processing done on device
- Remote APIs: API key only shared with provider
- No data collection by Quiz Master extension
- User controls all data sharing
