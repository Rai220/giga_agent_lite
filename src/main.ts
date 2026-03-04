import './styles.css';

const chat = document.getElementById('chat')!;
const input = document.getElementById('message-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn')!;
const providerSelect = document.getElementById('provider-select') as HTMLSelectElement;
const settingsBtn = document.getElementById('settings-btn')!;

function appendMessage(role: 'user' | 'assistant', text: string): void {
  const welcome = chat.querySelector('.chat__welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = `message message--${role}`;
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function handleSend(): void {
  const text = input.value.trim();
  if (!text) return;

  appendMessage('user', text);
  input.value = '';

  const provider = providerSelect.value;
  appendMessage(
    'assistant',
    `[${provider}] Agent loop not yet implemented. Configure your API key in settings to get started.`,
  );
}

sendBtn.addEventListener('click', handleSend);

input.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

settingsBtn.addEventListener('click', () => {
  const provider = providerSelect.value;
  window.alert(`Settings for ${provider} — coming soon.`);
});

console.log('GigaAgent Lite initialized');
