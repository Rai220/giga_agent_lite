const MEMORY_KEY = 'agent_memory';
const MAX_ENTRIES = 50;

export interface MemoryEntry {
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type MemoryStore = Record<string, MemoryEntry>;

export function loadMemory(): MemoryStore {
  const raw = localStorage.getItem(MEMORY_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as MemoryStore;
  } catch {
    return {};
  }
}

function saveMemoryStore(store: MemoryStore): void {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(store));
}

export function memorySave(key: string, content: string): string {
  const store = loadMemory();
  const now = new Date().toISOString();
  const existing = store[key];
  if (existing) {
    store[key] = { content, createdAt: existing.createdAt, updatedAt: now };
  } else {
    if (Object.keys(store).length >= MAX_ENTRIES) {
      return `Memory is full (max ${MAX_ENTRIES} entries). Delete some entries first.`;
    }
    store[key] = { content, createdAt: now, updatedAt: now };
  }
  saveMemoryStore(store);
  return `Saved to memory: [${key}] = "${content}"`;
}

export function memoryList(): string {
  const store = loadMemory();
  const keys = Object.keys(store);
  if (keys.length === 0) return 'Memory is empty.';
  const lines = keys.map(
    (k) => `• [${k}]: ${store[k]!.content} (updated: ${store[k]!.updatedAt})`,
  );
  return `Memory entries (${keys.length}/${MAX_ENTRIES}):\n${lines.join('\n')}`;
}

export function memoryDelete(key: string): string {
  const store = loadMemory();
  if (!store[key]) return `Memory entry "${key}" not found.`;
  delete store[key];
  saveMemoryStore(store);
  return `Deleted memory entry: "${key}"`;
}

export function getMemoryForPrompt(): string {
  const store = loadMemory();
  const keys = Object.keys(store);
  if (keys.length === 0) return '';
  const lines = keys.map((k) => `- [${k}]: ${store[k]!.content}`);
  return `\n\n## Your memory about the user\n${lines.join('\n')}`;
}
