import { ChatOpenAI } from '@langchain/openai';
import type { OpenAISettings } from '../types';

export function createOpenAIModel(settings: OpenAISettings): ChatOpenAI {
  return new ChatOpenAI({
    openAIApiKey: settings.apiKey,
    modelName: settings.model || 'gpt-4o',
  });
}
