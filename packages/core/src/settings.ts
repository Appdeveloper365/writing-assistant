import type { Settings } from './types';

export const defaultSettings: Settings = {
  tone: 'professional',
  aiMode: 'local',
  remoteProvider: 'openai',
  remoteModel: 'gpt-4o-mini',
  apiKey: '',
  localAiEnabled: false,
  localModelPath: '',
  localModelName: '',
  localModelHistory: [],
  localPermissionGranted: false,
  cloudRewriteEnabled: false,
  suggestionsEnabled: true,
  requireConfirmation: true,
  showPreview: true,
};
