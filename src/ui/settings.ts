import type {
  ProviderType,
  GigaChatSettings,
  OpenAISettings,
  AnthropicSettings,
  GeminiSettings,
  ProviderSettingsMap,
} from '../types';
import { loadSettings } from '../storage';

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderSettingsForm(
  container: HTMLElement,
  provider: ProviderType,
): void {
  // Render provider-specific form first
  const providerDiv = document.createElement('div');
  switch (provider) {
    case 'gigachat':
      renderGigaChatForm(providerDiv);
      break;
    case 'openai':
      renderOpenAIForm(providerDiv);
      break;
    case 'anthropic':
      renderAnthropicForm(providerDiv);
      break;
    case 'gemini':
      renderGeminiForm(providerDiv);
      break;
  }

  // Append global tools section
  const ddgUrl = localStorage.getItem('ddg_proxy_url') ?? '';
  const toolsHtml = `
    <hr style="margin:16px 0;border:none;border-top:1px solid var(--border, #333)"/>
    <h4 style="margin:0 0 8px">Web Search (DuckDuckGo)</h4>
    <div class="form-group">
      <label for="ddg-proxy-url">DDG Proxy URL</label>
      <input type="text" id="ddg-proxy-url" value="${esc(ddgUrl)}" placeholder="https://your-ddg-proxy.workers.dev" />
      <div class="form-hint" style="margin-top:4px">Deploy <code>worker/</code> as Cloudflare Worker, then paste the URL here. Required for web search on GitHub Pages.</div>
    </div>
  `;

  container.innerHTML = providerDiv.innerHTML + toolsHtml;
}

function renderGigaChatForm(container: HTMLElement): void {
  const saved = loadSettings('gigachat');
  const d = __DEV_DEFAULTS__.gigachat;

  container.innerHTML = `
    <div class="form-group">
      <label for="gc-user">User</label>
      <input type="text" id="gc-user" value="${esc(saved?.user ?? d.user)}" placeholder="Username" />
    </div>
    <div class="form-group">
      <label for="gc-password">Password</label>
      <input type="password" id="gc-password" value="${esc(saved?.password ?? d.password)}" placeholder="Password" />
    </div>
    <div class="form-group">
      <label for="gc-credentials">Authorization Key <small>(alternative to User+Password)</small></label>
      <input type="password" id="gc-credentials" value="${esc(saved?.credentials ?? '')}" placeholder="Base64 credentials" />
    </div>
    <div class="form-group">
      <label for="gc-baseurl">Base URL</label>
      <input type="text" id="gc-baseurl" value="${esc(saved?.baseUrl ?? (d.baseUrl || 'https://gigachat.devices.sberbank.ru/api/v1'))}" placeholder="https://gigachat.devices.sberbank.ru/api/v1" />
    </div>
    <div class="form-group">
      <label for="gc-proxy">CORS Proxy <small>(required for browser access)</small></label>
      <input type="text" id="gc-proxy" value="${esc(saved?.corsProxy ?? '')}" placeholder="https://your-proxy.workers.dev" />
      <div class="form-hint" style="margin-top:4px">Needed when running in browser (GitHub Pages). Requests are sent as <code>proxy/baseUrl/endpoint</code>.</div>
    </div>
    <div class="form-group">
      <label for="gc-model">Model</label>
      <input type="text" id="gc-model" value="${esc(saved?.model ?? d.model)}" placeholder="GigaChat" />
    </div>
    <div class="form-group">
      <label for="gc-scope">Scope</label>
      <select id="gc-scope">
        <option value="GIGACHAT_API_PERS" ${(saved?.scope ?? d.scope) === 'GIGACHAT_API_PERS' ? 'selected' : ''}>GIGACHAT_API_PERS</option>
        <option value="GIGACHAT_API_B2B" ${(saved?.scope ?? d.scope) === 'GIGACHAT_API_B2B' ? 'selected' : ''}>GIGACHAT_API_B2B</option>
        <option value="GIGACHAT_API_CORP" ${(saved?.scope ?? d.scope) === 'GIGACHAT_API_CORP' ? 'selected' : ''}>GIGACHAT_API_CORP</option>
      </select>
    </div>
    <p class="form-hint">Fill either <b>User + Password</b> or <b>Authorization Key</b>.</p>
  `;
}

function renderOpenAIForm(container: HTMLElement): void {
  const saved = loadSettings('openai');
  container.innerHTML = `
    <div class="form-group">
      <label for="oai-key">API Key</label>
      <input type="password" id="oai-key" value="${esc(saved?.apiKey ?? '')}" placeholder="sk-..." />
    </div>
    <div class="form-group">
      <label for="oai-model">Model</label>
      <input type="text" id="oai-model" value="${esc(saved?.model ?? 'gpt-4o')}" placeholder="gpt-4o" />
    </div>
  `;
}

function renderAnthropicForm(container: HTMLElement): void {
  const saved = loadSettings('anthropic');
  container.innerHTML = `
    <div class="form-group">
      <label for="anth-key">API Key</label>
      <input type="password" id="anth-key" value="${esc(saved?.apiKey ?? '')}" placeholder="sk-ant-..." />
    </div>
    <div class="form-group">
      <label for="anth-model">Model</label>
      <input type="text" id="anth-model" value="${esc(saved?.model ?? 'claude-sonnet-4-20250514')}" placeholder="claude-sonnet-4-20250514" />
    </div>
  `;
}

function renderGeminiForm(container: HTMLElement): void {
  const saved = loadSettings('gemini');
  container.innerHTML = `
    <div class="form-group">
      <label for="gem-key">API Key</label>
      <input type="password" id="gem-key" value="${esc(saved?.apiKey ?? '')}" placeholder="AIza..." />
    </div>
    <div class="form-group">
      <label for="gem-model">Model</label>
      <input type="text" id="gem-model" value="${esc(saved?.model ?? 'gemini-2.0-flash')}" placeholder="gemini-2.0-flash" />
    </div>
    <p class="form-hint">Get your API key at <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--primary)">Google AI Studio</a>.</p>
  `;
}

export function collectSettings(
  provider: ProviderType,
): ProviderSettingsMap[typeof provider] {
  switch (provider) {
    case 'gigachat':
      return {
        user: (document.getElementById('gc-user') as HTMLInputElement).value,
        password: (document.getElementById('gc-password') as HTMLInputElement)
          .value,
        credentials: (
          document.getElementById('gc-credentials') as HTMLInputElement
        ).value,
        baseUrl: (document.getElementById('gc-baseurl') as HTMLInputElement)
          .value,
        corsProxy: (document.getElementById('gc-proxy') as HTMLInputElement)
          .value,
        model: (document.getElementById('gc-model') as HTMLInputElement).value,
        scope: (document.getElementById('gc-scope') as HTMLSelectElement).value,
      } satisfies GigaChatSettings as ProviderSettingsMap[typeof provider];
    case 'openai':
      return {
        apiKey: (document.getElementById('oai-key') as HTMLInputElement).value,
        model: (document.getElementById('oai-model') as HTMLInputElement).value,
      } satisfies OpenAISettings as ProviderSettingsMap[typeof provider];
    case 'anthropic':
      return {
        apiKey: (document.getElementById('anth-key') as HTMLInputElement).value,
        model: (document.getElementById('anth-model') as HTMLInputElement)
          .value,
      } satisfies AnthropicSettings as ProviderSettingsMap[typeof provider];
    case 'gemini':
      return {
        apiKey: (document.getElementById('gem-key') as HTMLInputElement).value,
        model: (document.getElementById('gem-model') as HTMLInputElement).value,
      } satisfies GeminiSettings as ProviderSettingsMap[typeof provider];
  }
}
