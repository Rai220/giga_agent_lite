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
} from './storage';
import { sendChatMessage } from './agent';
import {
  appendMessage,
  renderMessages,
  showTypingIndicator,
} from './ui/chat';
import { renderSidebar } from './ui/sidebar';
import { renderSettingsForm, collectSettings } from './ui/settings';

const PROVIDER_LABELS: Record<ProviderType, string> = {
  gigachat: 'GigaChat',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
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
      baseUrl: __DEV_DEFAULTS__.gigachat.baseUrl,
      model: __DEV_DEFAULTS__.gigachat.model,
      scope: __DEV_DEFAULTS__.gigachat.scope,
    });
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

async function handleSend(): Promise<void> {
  const text = inputEl.value.trim();
  if (!text || isSending) return;

  if (!activeConversation) {
    activeConversation = newConversation();
  }

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
    const answer = await sendChatMessage(
      activeProvider,
      settings,
      prevMessages,
      text,
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
    const msg = err instanceof Error ? err.message : 'Unknown error';
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
  closeSettings();
});

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
