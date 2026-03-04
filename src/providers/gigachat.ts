import { GigaChat as GigaChatClient } from 'gigachat';
import type { Message } from 'gigachat/interfaces';
import type { GigaChatSettings, ChatMessage } from '../types';

const SYSTEM_PROMPT = `You are GigaAgent Lite — a helpful universal AI assistant running in the browser.
You can answer questions, help with analysis, writing, coding, and other tasks.
Be concise, helpful, and use markdown formatting when appropriate.`;

function toApiMessages(
  history: ChatMessage[],
  userMessage: string,
): Message[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];
}

export async function chatWithGigaChat(
  settings: GigaChatSettings,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const opts: Record<string, unknown> = {
    dangerouslyAllowBrowser: true,
    model: settings.model || 'GigaChat',
  };

  if (settings.baseUrl) opts.baseUrl = settings.baseUrl;
  if (settings.scope) opts.scope = settings.scope;

  if (settings.credentials) {
    opts.credentials = settings.credentials;
  } else if (settings.user && settings.password) {
    opts.user = settings.user;
    opts.password = settings.password;
  }

  const client = new GigaChatClient(opts);

  const messages = toApiMessages(history, userMessage);

  const response = await client.chat({
    model: settings.model || 'GigaChat',
    messages,
  });

  const choice = response.choices[0];
  return choice?.message?.content ?? '';
}
