import type { Conversation, ProviderType, ProviderSettingsMap } from './types';

const CONVERSATIONS_KEY = 'gigaagent_conversations';
const ACTIVE_CONV_KEY = 'gigaagent_active_conversation';
const PROVIDER_KEY = 'gigaagent_active_provider';

function settingsKey(provider: ProviderType): string {
  return `gigaagent_settings_${provider}`;
}

export function loadSettings<T extends ProviderType>(
  provider: T,
): ProviderSettingsMap[T] | null {
  const raw = localStorage.getItem(settingsKey(provider));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProviderSettingsMap[T];
  } catch {
    return null;
  }
}

export function saveSettings<T extends ProviderType>(
  provider: T,
  settings: ProviderSettingsMap[T],
): void {
  localStorage.setItem(settingsKey(provider), JSON.stringify(settings));
}

export function loadActiveProvider(): ProviderType {
  return (localStorage.getItem(PROVIDER_KEY) as ProviderType) || 'gigachat';
}

export function saveActiveProvider(provider: ProviderType): void {
  localStorage.setItem(PROVIDER_KEY, provider);
}

export function loadConversations(): Conversation[] {
  const raw = localStorage.getItem(CONVERSATIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

function saveAllConversations(conversations: Conversation[]): void {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function saveConversation(conv: Conversation): void {
  const all = loadConversations();
  const idx = all.findIndex((c) => c.id === conv.id);
  if (idx >= 0) all[idx] = conv;
  else all.unshift(conv);
  saveAllConversations(all);
}

export function deleteConversation(id: string): void {
  const all = loadConversations().filter((c) => c.id !== id);
  saveAllConversations(all);
}

export function loadActiveConversationId(): string | null {
  return localStorage.getItem(ACTIVE_CONV_KEY);
}

export function saveActiveConversationId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_CONV_KEY, id);
  else localStorage.removeItem(ACTIVE_CONV_KEY);
}
