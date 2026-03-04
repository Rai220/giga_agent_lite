import { marked } from 'marked';
import hljs from 'highlight.js';

function renderMarkdown(text: string): string {
  const result = marked.parse(text, { async: false });
  return typeof result === 'string' ? result : '';
}

function highlightCodeBlocks(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('pre code').forEach((el) => {
    hljs.highlightElement(el);
  });
}

export function appendMessage(
  chatEl: HTMLElement,
  role: 'user' | 'assistant' | 'error',
  content: string,
): HTMLElement {
  const welcome = chatEl.querySelector('.chat__welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = `message message--${role}`;

  if (role === 'assistant') {
    div.innerHTML = renderMarkdown(content);
    highlightCodeBlocks(div);
  } else {
    div.textContent = content;
  }

  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

export function clearChat(chatEl: HTMLElement): void {
  chatEl.innerHTML = '';
}

export function showWelcome(chatEl: HTMLElement): void {
  chatEl.innerHTML = `
    <div class="chat__welcome">
      <h2>GigaAgent Lite</h2>
      <p>Universal LLM agent: GigaChat, OpenAI, Anthropic.</p>
      <p>Configure API keys in ⚙ settings, then start chatting.</p>
    </div>
  `;
}

export function renderMessages(
  chatEl: HTMLElement,
  messages: { role: 'user' | 'assistant'; content: string }[],
): void {
  clearChat(chatEl);
  if (messages.length === 0) {
    showWelcome(chatEl);
    return;
  }
  messages.forEach((m) => appendMessage(chatEl, m.role, m.content));
}

export function showTypingIndicator(chatEl: HTMLElement): HTMLElement {
  const div = document.createElement('div');
  div.className = 'message message--assistant message--typing';
  div.innerHTML =
    '<span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>';
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}
