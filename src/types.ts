export type ProviderType = 'gigachat' | 'openai' | 'anthropic' | 'gemini';

export interface GigaChatSettings {
  user: string;
  password: string;
  credentials: string;
  baseUrl: string;
  corsProxy: string;
  model: string;
  scope: string;
}

export interface OpenAISettings {
  apiKey: string;
  model: string;
}

export interface AnthropicSettings {
  apiKey: string;
  model: string;
}

export interface GeminiSettings {
  apiKey: string;
  model: string;
}

export interface ProviderSettingsMap {
  gigachat: GigaChatSettings;
  openai: OpenAISettings;
  anthropic: AnthropicSettings;
  gemini: GeminiSettings;
}

export interface UploadedFile {
  name: string;
  content: string;
  size: number;
  type: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  provider: ProviderType;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
