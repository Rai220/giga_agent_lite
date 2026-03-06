import './styles.css';
import 'highlight.js/styles/github-dark.css';

import type { Conversation, ChatMessage, ProviderType } from './types';
import {
  loadSettings,
  saveSettings,
  loadActiveProvider,
  saveActiveProvider,
  loadConversations,
  saveConversation,
  deleteConversation,
  loadActiveConversationId,
  saveActiveConversationId,
  loadGlobalCorsProxy,
  saveGlobalCorsProxy,
} from './storage';
import { sendAgentMessage } from './agent';
import {
  appendMessage,
  appendToolCall,
  appendToolResult,
  appendGeneratedImage,
  appendDocumentCard,
  renderMessages,
  showTypingIndicator,
} from './ui/chat';
import { renderSidebar } from './ui/sidebar';
import { renderSettingsForm, collectSettings, collectCorsProxy } from './ui/settings';
import {
  addUploadedFile,
  readFileAsText,
  listUploadedFiles,
  removeUploadedFile,
} from './tools/file-upload';
import { setDirectoryHandle } from './tools/file-system';

const PROVIDER_LABELS: Record<ProviderType, string> = {
  gigachat: 'GigaChat',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
};

let activeConversation: Conversation | null = null;
let activeProvider: ProviderType = loadActiveProvider();
let isSending = false;

const chatEl = document.getElementById('chat')!;
const inputEl = document.getElementById('message-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const providerSelect = document.getElementById(
  'provider-select',
) as HTMLSelectElement;
const settingsBtn = document.getElementById('settings-btn')!;
const newChatBtn = document.getElementById('new-chat-btn')!;
const convListEl = document.getElementById('conversation-list')!;
const sidebarEl = document.getElementById('sidebar')!;
const sidebarToggle = document.getElementById('sidebar-toggle')!;
const attachBtn = document.getElementById('attach-btn')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const attachmentsEl = document.getElementById('attachments')!;
const dirBtn = document.getElementById('dir-btn')!;
const dirStatus = document.getElementById('dir-status')!;

const modal = document.getElementById('settings-modal')!;
const modalTitle = document.getElementById('modal-title')!;
const modalBody = document.getElementById('settings-body')!;
const modalSave = document.getElementById('settings-save')!;
const modalCancel = document.getElementById('settings-cancel')!;
const modalClose = modal.querySelector('.modal__close')!;

function initDefaults(): void {
  if (!loadSettings('gigachat') && __DEV_DEFAULTS__.gigachat.user) {
    saveSettings('gigachat', {
      user: __DEV_DEFAULTS__.gigachat.user,
      password: __DEV_DEFAULTS__.gigachat.password,
      credentials: '',
      corsProxy: '',
      baseUrl: __DEV_DEFAULTS__.gigachat.baseUrl,
      model: __DEV_DEFAULTS__.gigachat.model,
      scope: __DEV_DEFAULTS__.gigachat.scope,
    });
  }
  if (!loadSettings('gemini') && __DEV_DEFAULTS__.gemini.apiKey) {
    saveSettings('gemini', {
      apiKey: __DEV_DEFAULTS__.gemini.apiKey,
      model: __DEV_DEFAULTS__.gemini.model,
    });
  }
  const gc = loadSettings('gigachat');
  if (gc?.corsProxy && !loadGlobalCorsProxy()) {
    saveGlobalCorsProxy(gc.corsProxy);
  }
}

function refreshSidebar(): void {
  renderSidebar(
    convListEl,
    loadConversations(),
    activeConversation?.id ?? null,
    selectConversation,
    handleDelete,
  );
}

function refreshChat(): void {
  renderMessages(chatEl, activeConversation?.messages ?? []);
}

function selectConversation(id: string): void {
  const conv = loadConversations().find((c) => c.id === id);
  if (!conv) return;
  activeConversation = conv;
  saveActiveConversationId(id);
  refreshSidebar();
  refreshChat();
  sidebarEl.classList.remove('sidebar--open');
}

function handleDelete(id: string): void {
  deleteConversation(id);
  if (activeConversation?.id === id) {
    activeConversation = null;
    saveActiveConversationId(null);
  }
  refreshSidebar();
  refreshChat();
}

function newConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    provider: activeProvider,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ── Directory picker for file system tools ──

dirBtn.addEventListener('click', async () => {
  try {
    const handle = await (window as unknown as { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
    setDirectoryHandle(handle);
    dirStatus.textContent = `📂 ${handle.name}`;
    dirStatus.title = `Working directory: ${handle.name}`;
  } catch {
    // User cancelled
  }
});

// ── File attachments ──

function refreshAttachmentsUI(): void {
  const files = listUploadedFiles();
  if (files.length === 0) {
    attachmentsEl.hidden = true;
    attachmentsEl.innerHTML = '';
    return;
  }
  attachmentsEl.hidden = false;
  attachmentsEl.innerHTML = files
    .map(
      (f) =>
        `<span class="attachment-chip" data-name="${f.name.replace(/"/g, '&quot;')}">📄 ${f.name} <small>(${(f.size / 1024).toFixed(1)} KB)</small><button class="attachment-chip__remove" title="Remove">&times;</button></span>`,
    )
    .join('');

  attachmentsEl.querySelectorAll('.attachment-chip__remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const chip = (e.target as HTMLElement).closest('.attachment-chip') as HTMLElement | null;
      const name = chip?.dataset.name;
      if (name) {
        removeUploadedFile(name);
        refreshAttachmentsUI();
      }
    });
  });
}

attachBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const files = fileInput.files;
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    const uploaded = await readFileAsText(file);
    addUploadedFile(uploaded);
  }
  fileInput.value = '';
  refreshAttachmentsUI();
});

// ── Send message ──

function buildUserMessageWithFileContext(text: string): string {
  const files = listUploadedFiles();
  if (files.length === 0) return text;
  const names = files.map((f) => f.name).join(', ');
  return `${text}\n\n[Attached files: ${names}]`;
}

async function handleSend(): Promise<void> {
  const text = inputEl.value.trim();
  if (!text || isSending) return;

  if (!activeConversation) {
    activeConversation = newConversation();
  }

  const messageForLLM = buildUserMessageWithFileContext(text);

  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  };
  activeConversation.messages.push(userMsg);

  if (
    activeConversation.messages.filter((m) => m.role === 'user').length === 1
  ) {
    activeConversation.title =
      text.slice(0, 50) + (text.length > 50 ? '...' : '');
  }

  appendMessage(chatEl, 'user', text);
  inputEl.value = '';

  isSending = true;
  sendBtn.disabled = true;
  const typing = showTypingIndicator(chatEl);

  try {
    const settings = loadSettings(activeProvider);
    if (!settings) throw new Error('Configure API keys in ⚙ Settings first.');

    const prevMessages = activeConversation.messages.slice(0, -1);
    const answer = await sendAgentMessage(
      activeProvider,
      settings,
      prevMessages,
      messageForLLM,
      {
        onToolCall(name, args) {
          typing.remove();
          appendToolCall(chatEl, name, args);
        },
        onToolResult(name, result, isError) {
          appendToolResult(chatEl, name, result, isError);
        },
        onImageGenerated(imageDataUrl) {
          appendGeneratedImage(chatEl, imageDataUrl);
        },
        onDocumentCreated(filename, blobUrl, size) {
          appendDocumentCard(chatEl, filename, blobUrl, size);
        },
      },
    );

    typing.remove();

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: answer,
      timestamp: Date.now(),
    };
    activeConversation.messages.push(assistantMsg);
    appendMessage(chatEl, 'assistant', answer);
  } catch (err) {
    typing.remove();
    const msg = extractErrorMessage(err);
    appendMessage(chatEl, 'error', `Error: ${msg}`);
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    activeConversation.updatedAt = Date.now();
    saveConversation(activeConversation);
    saveActiveConversationId(activeConversation.id);
    refreshSidebar();
  }
}

sendBtn.addEventListener('click', () => void handleSend());

inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void handleSend();
  }
});

newChatBtn.addEventListener('click', () => {
  activeConversation = null;
  saveActiveConversationId(null);
  refreshSidebar();
  refreshChat();
  inputEl.focus();
});

providerSelect.addEventListener('change', () => {
  activeProvider = providerSelect.value as ProviderType;
  saveActiveProvider(activeProvider);
});

sidebarToggle.addEventListener('click', () => {
  sidebarEl.classList.toggle('sidebar--open');
});

function openSettings(): void {
  modalTitle.textContent = `Settings — ${PROVIDER_LABELS[activeProvider]}`;
  renderSettingsForm(modalBody, activeProvider);
  modal.hidden = false;
}

function closeSettings(): void {
  modal.hidden = true;
}

settingsBtn.addEventListener('click', openSettings);
modalCancel.addEventListener('click', closeSettings);
modalClose.addEventListener('click', closeSettings);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeSettings();
});

modalSave.addEventListener('click', () => {
  const values = collectSettings(activeProvider);
  saveSettings(activeProvider, values);
  saveGlobalCorsProxy(collectCorsProxy());
  closeSettings();
});

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message !== '[object Object]') return err.message;
    const resp = (err as unknown as Record<string, unknown>).response;
    if (resp && typeof resp === 'object') {
      const data = (resp as Record<string, unknown>).data;
      try { return JSON.stringify(data ?? resp, null, 2); } catch { /* fall through */ }
    }
    return JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
  }
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err, null, 2); } catch { return String(err); }
}

function init(): void {
  initDefaults();
  providerSelect.value = activeProvider;

  const savedId = loadActiveConversationId();
  if (savedId) {
    const conv = loadConversations().find((c) => c.id === savedId);
    if (conv) activeConversation = conv;
  }

  refreshSidebar();
  refreshChat();
}

init();
