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
import { loadGlobalCorsProxy } from './storage';
import { ALL_FUNCTIONS } from './tools/definitions';
import { executeJs } from './tools/execute-js';
import { webSearch } from './tools/web-search';
import {
  getUploadedFile,
  listUploadedFiles,
} from './tools/file-upload';

const MAX_ITERATIONS = 15;

const SYSTEM_PROMPT = `You are GigaAgent Lite — a helpful AI assistant that runs in the browser.
You have access to the following tools:

• execute_js — run JavaScript code in an isolated sandbox (calculations, data processing, etc.)
• web_search — search the internet via DuckDuckGo
• read_uploaded_file — read content of a file the user has uploaded
• list_uploaded_files — list all uploaded files
• current_datetime — get the current date and time

When the user asks you to calculate, process data, write code, or do anything computable — use execute_js.
When the user asks about current events, facts, or anything you need to look up — use web_search.
When the user attaches files, use list_uploaded_files and read_uploaded_file to work with them.
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

  if (name === 'web_search') {
    const query =
      typeof args.query === 'string' ? args.query : String(args.query ?? '');
    try {
      const result = await webSearch(query);
      return { result, isError: false };
    } catch (err) {
      return {
        result: `Search error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  }

  if (name === 'read_uploaded_file') {
    const filename =
      typeof args.filename === 'string'
        ? args.filename
        : String(args.filename ?? '');
    const file = getUploadedFile(filename);
    if (!file) {
      const available = listUploadedFiles();
      const names = available.map((f) => f.name).join(', ');
      return {
        result: `File "${filename}" not found. Available files: ${names || '(none)'}`,
        isError: true,
      };
    }
    return { result: file.content, isError: false };
  }

  if (name === 'list_uploaded_files') {
    const files = listUploadedFiles();
    if (files.length === 0) {
      return { result: 'No files uploaded.', isError: false };
    }
    const lines = files.map(
      (f) => `• ${f.name} (${(f.size / 1024).toFixed(1)} KB, ${f.type})`,
    );
    return { result: `Uploaded files:\n${lines.join('\n')}`, isError: false };
  }

  if (name === 'current_datetime') {
    const now = new Date();
    return {
      result: now.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      }),
      isError: false,
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
  const corsProxy = settings.corsProxy || loadGlobalCorsProxy();
  if (corsProxy && baseUrl && !baseUrl.startsWith('/')) {
    baseUrl = corsProxy.replace(/\/+$/, '') + '/' + baseUrl;
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

// ── OpenAI / Anthropic / Gemini agent (LangChain) ──

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

const webSearchLangChainTool = tool(
  async (input: { query: string }) => {
    return webSearch(input.query);
  },
  {
    name: 'web_search',
    description:
      'Search the internet using DuckDuckGo. Use when the user asks about current events, needs to look something up, or needs information you don\'t have.',
    schema: z.object({
      query: z.string().describe('The search query.'),
    }),
  },
);

const readFileLangChainTool = tool(
  async (input: { filename: string }) => {
    const file = getUploadedFile(input.filename);
    if (!file) {
      const available = listUploadedFiles();
      const names = available.map((f) => f.name).join(', ');
      return `File "${input.filename}" not found. Available: ${names || '(none)'}`;
    }
    return file.content;
  },
  {
    name: 'read_uploaded_file',
    description: 'Read content of a file the user has uploaded.',
    schema: z.object({
      filename: z.string().describe('Name of the uploaded file.'),
    }),
  },
);

const listFilesLangChainTool = tool(
  async () => {
    const files = listUploadedFiles();
    if (files.length === 0) return 'No files uploaded.';
    return files
      .map((f) => `• ${f.name} (${(f.size / 1024).toFixed(1)} KB, ${f.type})`)
      .join('\n');
  },
  {
    name: 'list_uploaded_files',
    description: 'List all files the user has uploaded.',
    schema: z.object({}),
  },
);

const datetimeLangChainTool = tool(
  async () => {
    return new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  },
  {
    name: 'current_datetime',
    description: 'Get the current date and time.',
    schema: z.object({}),
  },
);

const langchainTools = [
  executeJsLangChainTool,
  webSearchLangChainTool,
  readFileLangChainTool,
  listFilesLangChainTool,
  datetimeLangChainTool,
];

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
  const model = baseModel.bindTools(langchainTools);

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
