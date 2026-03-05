import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { GeminiSettings } from '../types';

export function createGeminiModel(settings: GeminiSettings): ChatGoogleGenerativeAI {
  return new ChatGoogleGenerativeAI({
    apiKey: settings.apiKey,
    model: settings.model || 'gemini-2.0-flash',
  });
}
