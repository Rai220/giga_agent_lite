export type ProviderType = 'gigachat' | 'openai' | 'anthropic';

export interface GigaChatSettings {
  user: string;
  password: string;
  credentials: string;
  baseUrl: string;
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

export interface ProviderSettingsMap {
  gigachat: GigaChatSettings;
  openai: OpenAISettings;
  anthropic: AnthropicSettings;
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
