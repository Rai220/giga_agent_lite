import { ChatAnthropic } from '@langchain/anthropic';
import type { AnthropicSettings } from '../types';

export function createAnthropicModel(settings: AnthropicSettings): ChatAnthropic {
  return new ChatAnthropic({
    anthropicApiKey: settings.apiKey,
    modelName: settings.model || 'claude-sonnet-4-20250514',
  });
}
