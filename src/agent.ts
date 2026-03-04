import { GigaChat as GigaChatClient } from 'gigachat';
import type { Message, Function as GigaChatFunction } from 'gigachat/interfaces';
import type { ChatMessage, ProviderType, ProviderSettingsMap, GigaChatSettings } from './types';
import { ALL_FUNCTIONS } from './tools/definitions';
import { executeJs } from './tools/execute-js';

const MAX_ITERATIONS = 15;

const SYSTEM_PROMPT = `You are GigaAgent Lite — a helpful AI assistant that runs in the browser.
You have access to tools. When the user asks you to calculate, process data, write code, or do anything computable — use the execute_js tool.
Always use tools when they can help. Show your work.
Be concise and use markdown formatting.`;

export interface AgentCallbacks {
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onToolResult: (name: string, result: string, isError: boolean) => void;
}

function buildClient(settings: GigaChatSettings): GigaChatClient {
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
  return new GigaChatClient(opts);
}

function historyToMessages(history: ChatMessage[], userMessage: string): Message[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: string; isError: boolean }> {
  if (name === 'execute_js') {
    const code = typeof args.code === 'string' ? args.code : String(args.code ?? '');
    const res = await executeJs(code);
    const parts: string[] = [];
    if (res.logs.length > 0) parts.push(`Console:\n${res.logs.join('\n')}`);
    if (res.output) parts.push(`Return: ${res.output}`);
    return {
      result: parts.length > 0 ? parts.join('\n') : '(no output)',
      isError: res.error,
    };
  }
  return { result: `Unknown tool: ${name}`, isError: true };
}

export async function sendAgentMessage(
  provider: ProviderType,
  settings: ProviderSettingsMap[ProviderType],
  history: ChatMessage[],
  userMessage: string,
  callbacks?: AgentCallbacks,
): Promise<string> {
  if (provider !== 'gigachat') {
    throw new Error(`Agent tool calling not yet supported for ${provider}. Use GigaChat.`);
  }

  const gcSettings = settings as GigaChatSettings;
  const client = buildClient(gcSettings);
  const messages = historyToMessages(history, userMessage);
  const functions: GigaChatFunction[] = ALL_FUNCTIONS;

  let lastToolResult = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let response;
    try {
      response = await client.chat({
        model: gcSettings.model || 'GigaChat',
        messages,
        functions,
        profanity_check: false,
      });
    } catch (apiErr) {
      if (i > 0 && lastToolResult) {
        return lastToolResult;
      }
      throw apiErr;
    }

    const choice = response.choices[0];
    if (!choice) throw new Error('Empty response from GigaChat');

    const msg = choice.message;
    messages.push(msg);

    if (!msg.function_call) {
      const c = msg.content;
      if (typeof c === 'string') return c;
      if (c == null) return lastToolResult || '';
      try { return JSON.stringify(c); } catch { return String(c); }
    }

    const fnName = msg.function_call.name;
    const fnArgs = (msg.function_call.arguments ?? {}) as Record<string, unknown>;

    callbacks?.onToolCall(fnName, fnArgs);

    const { result, isError } = await executeTool(fnName, fnArgs);
    lastToolResult = result;

    callbacks?.onToolResult(fnName, result, isError);

    messages.push({
      role: 'function',
      name: fnName,
      content: result,
    });
  }

  return 'Reached maximum number of agent iterations.';
}
