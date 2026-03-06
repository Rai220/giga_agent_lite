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

export function appendToolCall(
  chatEl: HTMLElement,
  name: string,
  args: Record<string, unknown>,
): HTMLElement {
  const welcome = chatEl.querySelector('.chat__welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');

  // Think and Critic tools — collapsible with distinct styling
  if (name === 'think' || name === 'critic') {
    div.className = `message message--${name}`;
    const header = document.createElement('div');
    header.className = `${name}-header`;
    header.textContent = name === 'think' ? '💭 Thinking...' : '🔍 Self-critique...';
    header.style.cursor = 'pointer';

    const body = document.createElement('div');
    body.className = `${name}-body`;
    body.textContent = String(name === 'think' ? args.thought ?? '' : args.criticism ?? '');
    body.style.display = 'none';

    header.addEventListener('click', () => {
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
      header.textContent = (name === 'think' ? '💭 ' : '🔍 ') +
        (body.style.display === 'none' ? (name === 'think' ? 'Thinking...' : 'Self-critique...') : (name === 'think' ? 'Thought' : 'Critique'));
    });

    div.appendChild(header);
    div.appendChild(body);
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    return div;
  }

  div.className = 'message message--tool';

  const header = document.createElement('div');
  header.className = 'tool-call__header';
  header.textContent = `🔧 ${name}`;
  div.appendChild(header);

  if (name === 'execute_js' && typeof args.code === 'string') {
    const codeEl = document.createElement('pre');
    const codeInner = document.createElement('code');
    codeInner.className = 'language-javascript';
    codeInner.textContent = args.code;
    codeEl.appendChild(codeInner);
    div.appendChild(codeEl);
    hljs.highlightElement(codeInner);
  } else {
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(args, null, 2);
    div.appendChild(pre);
  }

  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

export function appendToolResult(
  chatEl: HTMLElement,
  name: string,
  result: string,
  isError: boolean,
): HTMLElement {
  // Don't show result for think/critic tools
  if (name === 'think' || name === 'critic') {
    return document.createElement('div');
  }

  const div = document.createElement('div');
  div.className = `message message--tool-result${isError ? ' message--tool-error' : ''}`;

  // For large results (file reading), make collapsible
  if (result.length > 500 && !isError) {
    const preview = result.slice(0, 300);
    const summaryEl = document.createElement('div');
    summaryEl.className = 'tool-result__summary';
    summaryEl.textContent = preview + '...';
    div.appendChild(summaryEl);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'tool-result__toggle';
    toggleBtn.textContent = `Show full result (${(result.length / 1024).toFixed(1)} KB)`;
    div.appendChild(toggleBtn);

    const fullEl = document.createElement('div');
    fullEl.className = 'tool-result__full';
    fullEl.textContent = result;
    fullEl.style.display = 'none';
    div.appendChild(fullEl);

    toggleBtn.addEventListener('click', () => {
      const isHidden = fullEl.style.display === 'none';
      fullEl.style.display = isHidden ? 'block' : 'none';
      summaryEl.style.display = isHidden ? 'none' : 'block';
      toggleBtn.textContent = isHidden ? 'Collapse' : `Show full result (${(result.length / 1024).toFixed(1)} KB)`;
    });
  } else {
    div.textContent = result;
  }

  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

export function appendGeneratedImage(
  chatEl: HTMLElement,
  dataUrl: string,
): HTMLElement {
  const div = document.createElement('div');
  div.className = 'message message--tool-result message--generated-image';

  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = 'Generated chart/image';
  img.className = 'generated-image';
  div.appendChild(img);

  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
  return div;
}

export function appendDocumentCard(
  chatEl: HTMLElement,
  filename: string,
  blobUrl: string,
  size: number,
): HTMLElement {
  const div = document.createElement('div');
  div.className = 'message message--document';

  const icon = document.createElement('span');
  icon.className = 'document-card__icon';
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const iconMap: Record<string, string> = {
    csv: '📊', xlsx: '📊', pdf: '📄', md: '📝', txt: '📄',
  };
  icon.textContent = iconMap[ext] ?? '📎';
  div.appendChild(icon);

  const info = document.createElement('div');
  info.className = 'document-card__info';
  const nameEl = document.createElement('div');
  nameEl.className = 'document-card__name';
  nameEl.textContent = filename;
  const sizeEl = document.createElement('div');
  sizeEl.className = 'document-card__size';
  sizeEl.textContent = `${(size / 1024).toFixed(1)} KB`;
  info.appendChild(nameEl);
  info.appendChild(sizeEl);
  div.appendChild(info);

  const downloadBtn = document.createElement('a');
  downloadBtn.className = 'document-card__download btn btn--small';
  downloadBtn.href = blobUrl;
  downloadBtn.download = filename;
  downloadBtn.textContent = 'Download';
  div.appendChild(downloadBtn);

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
      <p>Universal LLM agent: GigaChat, OpenAI, Anthropic, Gemini.</p>
      <p>Configure API keys in ⚙ settings, then start chatting.</p>
      <p class="chat__welcome-hint">Tools: JS sandbox, web search, file reading (CSV/Excel/PDF), document creation, charts, memory</p>
      <p class="chat__welcome-hint">Try: "Build a bar chart of monthly sales" or "Create a PDF report"</p>
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
