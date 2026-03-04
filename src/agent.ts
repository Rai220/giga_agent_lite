import { GigaChat as GigaChatClient } from 'gigachat';
import type { Message, Function as GigaChatFunction } from 'gigachat/interfaces';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { AIMessageChunk } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type {
  ChatMessage,
  ProviderType,
  ProviderSettingsMap,
  GigaChatSettings,
} from './types';
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

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: string; isError: boolean }> {
  if (name === 'execute_js') {
    const code =
      typeof args.code === 'string' ? args.code : String(args.code ?? '');
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

// ── GigaChat agent ──

function buildGigaChatClient(settings: GigaChatSettings): GigaChatClient {
  const opts: Record<string, unknown> = {
    dangerouslyAllowBrowser: true,
    model: settings.model || 'GigaChat',
  };
  let baseUrl = settings.baseUrl || '';
  if (settings.corsProxy && baseUrl && !baseUrl.startsWith('/')) {
    baseUrl = settings.corsProxy.replace(/\/+$/, '') + '/' + baseUrl;
  }
  if (baseUrl) opts.baseUrl = baseUrl;
  if (settings.scope) opts.scope = settings.scope;
  if (settings.credentials) {
    opts.credentials = settings.credentials;
  } else if (settings.user && settings.password) {
    opts.user = settings.user;
    opts.password = settings.password;
  }
  return new GigaChatClient(opts);
}

async function gigachatAgent(
  settings: GigaChatSettings,
  history: ChatMessage[],
  userMessage: string,
  callbacks?: AgentCallbacks,
): Promise<string> {
  const client = buildGigaChatClient(settings);
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];
  const functions: GigaChatFunction[] = ALL_FUNCTIONS;
  let lastToolResult = '';

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let response;
    try {
      response = await client.chat({
        model: settings.model || 'GigaChat',
        messages,
        functions,
        profanity_check: false,
      });
    } catch (apiErr) {
      if (i > 0 && lastToolResult) return lastToolResult;
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
      try {
        return JSON.stringify(c);
      } catch {
        return String(c);
      }
    }

    const fnName = msg.function_call.name;
    const fnArgs = (msg.function_call.arguments ?? {}) as Record<
      string,
      unknown
    >;
    callbacks?.onToolCall(fnName, fnArgs);
    const { result, isError } = await executeTool(fnName, fnArgs);
    lastToolResult = result;
    callbacks?.onToolResult(fnName, result, isError);
    messages.push({ role: 'function', name: fnName, content: result });
  }
  return 'Reached maximum number of agent iterations.';
}

// ── OpenAI / Anthropic agent (LangChain) ──

const executeJsLangChainTool = tool(
  async (input: { code: string }) => {
    const res = await executeJs(input.code);
    const parts: string[] = [];
    if (res.logs.length > 0) parts.push(`Console:\n${res.logs.join('\n')}`);
    if (res.output) parts.push(`Return: ${res.output}`);
    return parts.length > 0 ? parts.join('\n') : '(no output)';
  },
  {
    name: 'execute_js',
    description:
      'Execute JavaScript code in an isolated sandbox. Use for calculations, data processing, string manipulation. Use "return <value>" to return a result. console.log() output is captured.',
    schema: z.object({
      code: z
        .string()
        .describe('JavaScript code to execute. Use "return expr" to return a value.'),
    }),
  },
);

async function langchainAgent(
  provider: ProviderType,
  settings: ProviderSettingsMap[ProviderType],
  history: ChatMessage[],
  userMessage: string,
  callbacks?: AgentCallbacks,
): Promise<string> {
  const { createLangChainModel } = await import('./providers');
  const baseModel = await createLangChainModel(provider, settings);
  if (!baseModel.bindTools) {
    throw new Error(`Provider "${provider}" does not support tool calling`);
  }
  const model = baseModel.bindTools([executeJsLangChainTool]);

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...history.map((m) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content),
    ),
    new HumanMessage(userMessage),
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = (await model.invoke(messages)) as AIMessageChunk;
    messages.push(response);

    const toolCalls = response.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      if (typeof response.content === 'string') return response.content;
      if (Array.isArray(response.content)) {
        return response.content
          .map((b) => (typeof b === 'string' ? b : 'text' in b ? b.text : ''))
          .join('');
      }
      return String(response.content);
    }

    for (const tc of toolCalls) {
      const args = (tc.args ?? {}) as Record<string, unknown>;
      callbacks?.onToolCall(tc.name, args);
      const { result, isError } = await executeTool(tc.name, args);
      callbacks?.onToolResult(tc.name, result, isError);
      messages.push(
        new ToolMessage({ content: result, tool_call_id: tc.id ?? '' }),
      );
      if (isError) break;
    }
  }
  return 'Reached maximum number of agent iterations.';
}

// ── Dispatcher ──

export async function sendAgentMessage(
  provider: ProviderType,
  settings: ProviderSettingsMap[ProviderType],
  history: ChatMessage[],
  userMessage: string,
  callbacks?: AgentCallbacks,
): Promise<string> {
  if (provider === 'gigachat') {
    return gigachatAgent(
      settings as GigaChatSettings,
      history,
      userMessage,
      callbacks,
    );
  }
  return langchainAgent(provider, settings, history, userMessage, callbacks);
}
