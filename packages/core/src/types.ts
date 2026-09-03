export type Tone = 'professional' | 'casual' | 'concise' | 'creative';
export type RewriteMode = 'local' | 'remote' | 'off';
export type Provider = 'local' | 'openai' | 'azure-openai' | 'anthropic' | 'openrouter';

export type Settings = {
  tone: Tone;
  aiMode: RewriteMode;
  remoteProvider: Provider;
  remoteModel: string;
  apiKey: string;
  localAiEnabled: boolean;
  localModelPath: string;
  localModelName: string;
  localModelHistory: Array<{ name: string; path: string }>;
  localPermissionGranted: boolean;
  cloudRewriteEnabled: boolean;
  suggestionsEnabled: boolean;
  requireConfirmation: boolean;
  showPreview: boolean;
};

export type RewriteRequest = {
  text: string;
  tone: Tone;
  mode: RewriteMode;
  provider?: string;
  apiKey?: string;
  model?: string;
};

export type RewriteResult = {
  variants: string[];
  model: string;
  status: 'ok' | 'error';
};
