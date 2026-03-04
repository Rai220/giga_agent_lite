import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ChatMessage, ProviderType, ProviderSettingsMap } from './types';
import { chatWithGigaChat } from './providers/gigachat';
import { createLangChainModel } from './providers';

const SYSTEM_PROMPT = `You are GigaAgent Lite — a helpful universal AI assistant running in the browser.
You can answer questions, help with analysis, writing, coding, and other tasks.
Be concise, helpful, and use markdown formatting when appropriate.`;

async function chatWithLangChain(
  model: BaseChatModel,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...history.map((m) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    ),
    new HumanMessage(userMessage),
  ];

  const response = await model.invoke(messages);

  if (typeof response.content === 'string') return response.content;
  if (Array.isArray(response.content)) {
    return response.content
      .map((block) => {
        if (typeof block === 'string') return block;
        if ('text' in block) return block.text;
        return '';
      })
      .join('');
  }
  return String(response.content);
}

export async function sendChatMessage(
  provider: ProviderType,
  settings: ProviderSettingsMap[ProviderType],
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  if (provider === 'gigachat') {
    return chatWithGigaChat(
      settings as ProviderSettingsMap['gigachat'],
      history,
      userMessage,
    );
  }

  const model = await createLangChainModel(provider, settings);
  return chatWithLangChain(model, history, userMessage);
}
