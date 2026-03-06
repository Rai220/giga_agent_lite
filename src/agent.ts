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
import { memorySave, memoryList, memoryDelete, getMemoryForPrompt } from './tools/memory';
import { createDocument } from './tools/create-document';
import { readCsv, readExcel, readPdf } from './tools/read-files';
import { fileRead, fileWrite, fileGrep } from './tools/file-system';

const MAX_ITERATIONS = 15;

function buildSystemPrompt(): string {
  const memoryBlock = getMemoryForPrompt();
  return `You are GigaAgent Lite — a powerful autonomous AI assistant that runs in the browser.
You have access to the following tools:

**Code & Computation:**
• execute_js — run JavaScript code in an isolated sandbox with Canvas and Chart.js support. For charts, use the provided \`canvas\`, \`ctx\`, and \`Chart\` variables. Return canvas.toDataURL() for images.

**Search:**
• web_search — search the internet via DuckDuckGo + Wikipedia

**File Upload (user-attached files):**
• read_uploaded_file — read text content of a user-uploaded file
• list_uploaded_files — list all uploaded files
• read_csv — parse a CSV file into structured JSON data
• read_excel — parse an Excel (.xlsx) file into structured JSON data (specify sheet name if needed)
• read_pdf — extract text from a PDF file

**File System (user-selected directory):**
• file_read — read a file from the user's working directory (supports line ranges)
• file_write — write/create a file in the user's working directory
• file_grep — search for patterns across files in the directory (regex + glob)

**Documents:**
• create_document — create a downloadable file (csv, xlsx, pdf, md, txt)

**Time:**
• current_datetime — get the current date and time

**Memory (persists across sessions):**
• memory_save — save a fact about the user or context (key + content)
• memory_list — list all saved memory entries
• memory_delete — delete a memory entry by key

**Reasoning:**
• think — think step-by-step before acting (logs your thought, no side effects)
• critic — critically evaluate your plan or results (logs criticism, no side effects)

## Behavior guidelines

You are an **autonomous agent**. When you receive a task:
1. Use \`think\` to plan your approach
2. Execute your plan step by step using tools — do NOT stop for confirmations on intermediate steps
3. After getting results, use \`critic\` to evaluate if the solution is correct
4. If you find issues, fix them without asking

## Charts and visualization

When the user asks to build a chart or graph:
- Use \`execute_js\` with Chart.js. The sandbox provides \`canvas\`, \`ctx\`, and \`Chart\` globals.
- Create the chart, then return \`canvas.toDataURL('image/png')\` so the image appears in chat.
- Example: \`new Chart(ctx, { type: 'bar', data: {...} }); return canvas.toDataURL('image/png');\`

## Working with files

- When reading files, do NOT repeat the entire file content back to the user. Provide a brief summary and work with the data silently.
- For CSV/Excel: use read_csv/read_excel to get structured data, then process it.
- For file system operations (file_read/file_write/file_grep): the user must select a directory first.

## Memory

When the user shares personal info, preferences, or asks you to remember something, use memory_save.
Your memory is included below.

Always use tools when they can help. Show your work.
Be concise and use markdown formatting.${memoryBlock}`;
}

export interface AgentCallbacks {
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onToolResult: (name: string, result: string, isError: boolean) => void;
  onImageGenerated?: (imageDataUrl: string) => void;
  onDocumentCreated?: (filename: string, blobUrl: string, size: number) => void;
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: string; isError: boolean; imageDataUrl?: string; documentInfo?: { filename: string; blobUrl: string; size: number } }> {
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
      imageDataUrl: res.imageDataUrl ?? undefined,
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

  // Think / Critic — no side effects
  if (name === 'think' || name === 'critic') {
    return { result: 'OK', isError: false };
  }

  // Memory tools
  if (name === 'memory_save') {
    const key = String(args.key ?? '');
    const content = String(args.content ?? '');
    return { result: memorySave(key, content), isError: false };
  }
  if (name === 'memory_list') {
    return { result: memoryList(), isError: false };
  }
  if (name === 'memory_delete') {
    const key = String(args.key ?? '');
    return { result: memoryDelete(key), isError: false };
  }

  // Document creation
  if (name === 'create_document') {
    const filename = String(args.filename ?? 'document.txt');
    const content = String(args.content ?? '');
    try {
      const doc = createDocument(filename, content);
      return {
        result: `Document "${doc.filename}" created (${(doc.size / 1024).toFixed(1)} KB).`,
        isError: false,
        documentInfo: { filename: doc.filename, blobUrl: doc.blobUrl, size: doc.size },
      };
    } catch (err) {
      return {
        result: `Document creation error: ${err instanceof Error ? err.message : String(err)}`,
        isError: true,
      };
    }
  }

  // File reading tools (CSV, Excel, PDF)
  if (name === 'read_csv') {
    const filename = String(args.filename ?? '');
    const file = getUploadedFile(filename);
    if (!file) {
      const available = listUploadedFiles().map((f) => f.name).join(', ');
      return { result: `File "${filename}" not found. Available: ${available || '(none)'}`, isError: true };
    }
    return { result: readCsv(file), isError: false };
  }

  if (name === 'read_excel') {
    const filename = String(args.filename ?? '');
    const sheet = args.sheet !== undefined ? String(args.sheet) : undefined;
    const file = getUploadedFile(filename);
    if (!file) {
      const available = listUploadedFiles().map((f) => f.name).join(', ');
      return { result: `File "${filename}" not found. Available: ${available || '(none)'}`, isError: true };
    }
    return { result: readExcel(file, sheet), isError: false };
  }

  if (name === 'read_pdf') {
    const filename = String(args.filename ?? '');
    const file = getUploadedFile(filename);
    if (!file) {
      const available = listUploadedFiles().map((f) => f.name).join(', ');
      return { result: `File "${filename}" not found. Available: ${available || '(none)'}`, isError: true };
    }
    return { result: await readPdf(file), isError: false };
  }

  // File system tools
  if (name === 'file_read') {
    const path = String(args.path ?? '');
    const offset = typeof args.offset === 'number' ? args.offset : undefined;
    const limit = typeof args.limit === 'number' ? args.limit : undefined;
    const result = await fileRead(path, offset, limit);
    return { result, isError: false };
  }

  if (name === 'file_write') {
    const path = String(args.path ?? '');
    const content = String(args.content ?? '');
    const result = await fileWrite(path, content);
    return { result, isError: false };
  }

  if (name === 'file_grep') {
    const pattern = String(args.pattern ?? '');
    const glob = args.glob !== undefined ? String(args.glob) : undefined;
    const result = await fileGrep(pattern, glob);
    return { result, isError: false };
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
    { role: 'system', content: buildSystemPrompt() },
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
    const { result, isError, imageDataUrl, documentInfo } = await executeTool(fnName, fnArgs);

    if (imageDataUrl) {
      callbacks?.onImageGenerated?.(imageDataUrl);
      callbacks?.onToolResult(fnName, result || 'Chart/image generated successfully.', false);
      const llmSummary = result ? `${result}\n\nChart/image generated and displayed to the user.` : 'Chart/image generated and displayed to the user.';
      lastToolResult = llmSummary;
      messages.push({ role: 'function', name: fnName, content: llmSummary });
    } else if (documentInfo) {
      callbacks?.onDocumentCreated?.(documentInfo.filename, documentInfo.blobUrl, documentInfo.size);
      callbacks?.onToolResult(fnName, result, false);
      lastToolResult = result;
      messages.push({ role: 'function', name: fnName, content: result });
    } else {
      lastToolResult = result;
      callbacks?.onToolResult(fnName, result, isError);
      messages.push({ role: 'function', name: fnName, content: result });
    }
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
    if (res.imageDataUrl) parts.push(`__IMAGE__:${res.imageDataUrl}`);
    return parts.length > 0 ? parts.join('\n') : '(no output)';
  },
  {
    name: 'execute_js',
    description:
      'Execute JavaScript code in an isolated sandbox with Canvas and Chart.js. ' +
      'The sandbox provides canvas, ctx, and Chart variables. ' +
      'For charts: create a Chart on ctx, then return canvas.toDataURL(). ' +
      'Use "return <value>" to return a result. console.log() output is captured.',
    schema: z.object({
      code: z.string().describe('JavaScript code to execute.'),
    }),
  },
);

const webSearchLangChainTool = tool(
  async (input: { query: string }) => webSearch(input.query),
  {
    name: 'web_search',
    description: 'Search the internet using DuckDuckGo + Wikipedia.',
    schema: z.object({ query: z.string().describe('The search query.') }),
  },
);

const readFileLangChainTool = tool(
  async (input: { filename: string }) => {
    const file = getUploadedFile(input.filename);
    if (!file) {
      const available = listUploadedFiles().map((f) => f.name).join(', ');
      return `File "${input.filename}" not found. Available: ${available || '(none)'}`;
    }
    return file.content;
  },
  {
    name: 'read_uploaded_file',
    description: 'Read content of a file the user has uploaded.',
    schema: z.object({ filename: z.string().describe('Name of the uploaded file.') }),
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
  async () => new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  }),
  {
    name: 'current_datetime',
    description: 'Get the current date and time.',
    schema: z.object({}),
  },
);

const thinkLangChainTool = tool(
  async () => 'OK',
  {
    name: 'think',
    description: 'Think step-by-step. Logs your thought, no side effects. Use for complex reasoning.',
    schema: z.object({ thought: z.string().describe('Your thought.') }),
  },
);

const criticLangChainTool = tool(
  async () => 'OK',
  {
    name: 'critic',
    description: 'Critically evaluate your plan or results. Logs criticism, no side effects.',
    schema: z.object({ criticism: z.string().describe('Your critical analysis.') }),
  },
);

const memorySaveLangChainTool = tool(
  async (input: { key: string; content: string }) => memorySave(input.key, input.content),
  {
    name: 'memory_save',
    description: 'Save a fact to persistent memory (key + content).',
    schema: z.object({
      key: z.string().describe('Topic key.'),
      content: z.string().describe('Fact to remember.'),
    }),
  },
);

const memoryListLangChainTool = tool(
  async () => memoryList(),
  {
    name: 'memory_list',
    description: 'List all saved memory entries.',
    schema: z.object({}),
  },
);

const memoryDeleteLangChainTool = tool(
  async (input: { key: string }) => memoryDelete(input.key),
  {
    name: 'memory_delete',
    description: 'Delete a memory entry by key.',
    schema: z.object({ key: z.string().describe('Key to delete.') }),
  },
);

const createDocumentLangChainTool = tool(
  async (input: { filename: string; content: string }) => {
    const doc = createDocument(input.filename, input.content);
    return `__DOCUMENT__:${JSON.stringify({ filename: doc.filename, blobUrl: doc.blobUrl, size: doc.size })}`;
  },
  {
    name: 'create_document',
    description: 'Create a downloadable document (csv, xlsx, pdf, md, txt).',
    schema: z.object({
      filename: z.string().describe('Filename with extension.'),
      content: z.string().describe('Document content.'),
    }),
  },
);

const readCsvLangChainTool = tool(
  async (input: { filename: string }) => {
    const file = getUploadedFile(input.filename);
    if (!file) return `File "${input.filename}" not found.`;
    return readCsv(file);
  },
  {
    name: 'read_csv',
    description: 'Parse an uploaded CSV file into structured JSON data.',
    schema: z.object({ filename: z.string().describe('CSV filename.') }),
  },
);

const readExcelLangChainTool = tool(
  async (input: { filename: string; sheet?: string }) => {
    const file = getUploadedFile(input.filename);
    if (!file) return `File "${input.filename}" not found.`;
    return readExcel(file, input.sheet);
  },
  {
    name: 'read_excel',
    description: 'Parse an uploaded Excel file into structured JSON data.',
    schema: z.object({
      filename: z.string().describe('Excel filename.'),
      sheet: z.string().optional().describe('Sheet name (optional).'),
    }),
  },
);

const readPdfLangChainTool = tool(
  async (input: { filename: string }) => {
    const file = getUploadedFile(input.filename);
    if (!file) return `File "${input.filename}" not found.`;
    return readPdf(file);
  },
  {
    name: 'read_pdf',
    description: 'Extract text from an uploaded PDF file.',
    schema: z.object({ filename: z.string().describe('PDF filename.') }),
  },
);

const fileReadLangChainTool = tool(
  async (input: { path: string; offset?: number; limit?: number }) =>
    fileRead(input.path, input.offset, input.limit),
  {
    name: 'file_read',
    description: 'Read a file from the user\'s working directory.',
    schema: z.object({
      path: z.string().describe('Relative file path.'),
      offset: z.number().optional().describe('Start line (1-based).'),
      limit: z.number().optional().describe('Number of lines.'),
    }),
  },
);

const fileWriteLangChainTool = tool(
  async (input: { path: string; content: string }) =>
    fileWrite(input.path, input.content),
  {
    name: 'file_write',
    description: 'Write a file in the user\'s working directory.',
    schema: z.object({
      path: z.string().describe('Relative file path.'),
      content: z.string().describe('Content to write.'),
    }),
  },
);

const fileGrepLangChainTool = tool(
  async (input: { pattern: string; glob?: string }) =>
    fileGrep(input.pattern, input.glob),
  {
    name: 'file_grep',
    description: 'Search for patterns across files in the user\'s directory.',
    schema: z.object({
      pattern: z.string().describe('Regex search pattern.'),
      glob: z.string().optional().describe('File glob filter.'),
    }),
  },
);

const langchainTools = [
  executeJsLangChainTool,
  webSearchLangChainTool,
  readFileLangChainTool,
  listFilesLangChainTool,
  datetimeLangChainTool,
  thinkLangChainTool,
  criticLangChainTool,
  memorySaveLangChainTool,
  memoryListLangChainTool,
  memoryDeleteLangChainTool,
  createDocumentLangChainTool,
  readCsvLangChainTool,
  readExcelLangChainTool,
  readPdfLangChainTool,
  fileReadLangChainTool,
  fileWriteLangChainTool,
  fileGrepLangChainTool,
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
    new SystemMessage(buildSystemPrompt()),
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
      const { result, isError, imageDataUrl, documentInfo } = await executeTool(tc.name, args);

      if (imageDataUrl) {
        callbacks?.onImageGenerated?.(imageDataUrl);
        callbacks?.onToolResult(tc.name, result || 'Chart/image generated.', false);
        messages.push(
          new ToolMessage({
            content: result ? `${result}\nChart/image displayed to user.` : 'Chart/image displayed to user.',
            tool_call_id: tc.id ?? '',
          }),
        );
      } else if (documentInfo) {
        callbacks?.onDocumentCreated?.(documentInfo.filename, documentInfo.blobUrl, documentInfo.size);
        callbacks?.onToolResult(tc.name, result, false);
        messages.push(new ToolMessage({ content: result, tool_call_id: tc.id ?? '' }));
      } else {
        // Handle LangChain tool markers
        let cleanResult = result;
        if (result.includes('__IMAGE__:')) {
          const imgMatch = result.match(/__IMAGE__:(data:image\/[^\s]+)/);
          if (imgMatch?.[1]) {
            callbacks?.onImageGenerated?.(imgMatch[1]);
            cleanResult = result.replace(/__IMAGE__:[^\s]+/, 'Chart/image displayed to user.');
          }
        }
        if (result.startsWith('__DOCUMENT__:')) {
          try {
            const docData = JSON.parse(result.replace('__DOCUMENT__:', '')) as { filename: string; blobUrl: string; size: number };
            callbacks?.onDocumentCreated?.(docData.filename, docData.blobUrl, docData.size);
            cleanResult = `Document "${docData.filename}" created (${(docData.size / 1024).toFixed(1)} KB).`;
          } catch { /* use raw result */ }
        }
        callbacks?.onToolResult(tc.name, cleanResult, isError);
        messages.push(
          new ToolMessage({ content: cleanResult, tool_call_id: tc.id ?? '' }),
        );
        if (isError) break;
      }
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
