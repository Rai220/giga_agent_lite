import type { Conversation } from '../types';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function renderSidebar(
  listEl: HTMLElement,
  conversations: Conversation[],
  activeId: string | null,
  onSelect: (id: string) => void,
  onDelete: (id: string) => void,
): void {
  listEl.innerHTML = '';

  const sorted = [...conversations].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );

  for (const conv of sorted) {
    const item = document.createElement('div');
    item.className = `sidebar__item${conv.id === activeId ? ' sidebar__item--active' : ''}`;

    const info = document.createElement('div');
    info.className = 'sidebar__item-info';
    info.addEventListener('click', () => onSelect(conv.id));

    const title = document.createElement('div');
    title.className = 'sidebar__item-title';
    title.textContent = conv.title || 'New Chat';

    const meta = document.createElement('div');
    meta.className = 'sidebar__item-meta';
    meta.textContent = `${conv.provider} · ${formatDate(conv.updatedAt)}`;

    info.appendChild(title);
    info.appendChild(meta);

    const del = document.createElement('button');
    del.className = 'sidebar__item-delete';
    del.textContent = '\u00d7';
    del.title = 'Delete';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      onDelete(conv.id);
    });

    item.appendChild(info);
    item.appendChild(del);
    listEl.appendChild(item);
  }

  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sidebar__empty';
    empty.textContent = 'No conversations yet';
    listEl.appendChild(empty);
  }
}
