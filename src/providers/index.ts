import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { ProviderType, ProviderSettingsMap } from '../types';

export async function createLangChainModel(
  provider: ProviderType,
  settings: ProviderSettingsMap[ProviderType],
): Promise<BaseChatModel> {
  switch (provider) {
    case 'openai': {
      const { createOpenAIModel } = await import('./openai');
      return createOpenAIModel(settings as ProviderSettingsMap['openai']);
    }
    case 'anthropic': {
      const { createAnthropicModel } = await import('./anthropic');
      return createAnthropicModel(
        settings as ProviderSettingsMap['anthropic'],
      );
    }
    default:
      throw new Error(`Provider "${String(provider)}" not supported via LangChain`);
  }
}
