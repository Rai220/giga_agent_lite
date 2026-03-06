let directoryHandle: FileSystemDirectoryHandle | null = null;

export function setDirectoryHandle(handle: FileSystemDirectoryHandle): void {
  directoryHandle = handle;
}

export function getDirectoryHandle(): FileSystemDirectoryHandle | null {
  return directoryHandle;
}

export function hasDirectoryAccess(): boolean {
  return directoryHandle !== null;
}

async function resolveFileHandle(
  dir: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemFileHandle> {
  const parts = path.split('/').filter(Boolean);
  let current: FileSystemDirectoryHandle = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i]!);
  }
  const fileName = parts[parts.length - 1]!;
  return current.getFileHandle(fileName);
}

async function resolveOrCreateFileHandle(
  dir: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemFileHandle> {
  const parts = path.split('/').filter(Boolean);
  let current: FileSystemDirectoryHandle = dir;
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i]!, { create: true });
  }
  const fileName = parts[parts.length - 1]!;
  return current.getFileHandle(fileName, { create: true });
}

export async function fileRead(
  path: string,
  offset?: number,
  limit?: number,
): Promise<string> {
  if (!directoryHandle) {
    return 'No directory selected. Ask the user to select a working directory first.';
  }
  try {
    const fh = await resolveFileHandle(directoryHandle, path);
    const file = await fh.getFile();
    const text = await file.text();
    const lines = text.split('\n');

    if (offset !== undefined || limit !== undefined) {
      const start = Math.max(0, (offset ?? 1) - 1);
      const end = limit !== undefined ? start + limit : lines.length;
      const slice = lines.slice(start, end);
      const numbered = slice.map((l, i) => `${start + i + 1}|${l}`);
      return `File: ${path} (${lines.length} lines total, showing ${start + 1}-${Math.min(end, lines.length)})\n${numbered.join('\n')}`;
    }

    if (lines.length > 500) {
      const numbered = lines.slice(0, 500).map((l, i) => `${i + 1}|${l}`);
      return `File: ${path} (${lines.length} lines, showing first 500)\n${numbered.join('\n')}\n... [truncated, use offset/limit to read more]`;
    }
    const numbered = lines.map((l, i) => `${i + 1}|${l}`);
    return `File: ${path} (${lines.length} lines)\n${numbered.join('\n')}`;
  } catch (err) {
    return `Error reading "${path}": ${err instanceof Error ? err.message : String(err)}`;
  }
}

export async function fileWrite(path: string, content: string): Promise<string> {
  if (!directoryHandle) {
    return 'No directory selected. Ask the user to select a working directory first.';
  }
  try {
    const fh = await resolveOrCreateFileHandle(directoryHandle, path);
    const writable = await fh.createWritable();
    await writable.write(content);
    await writable.close();
    const lines = content.split('\n').length;
    return `Written ${content.length} chars (${lines} lines) to ${path}`;
  } catch (err) {
    return `Error writing "${path}": ${err instanceof Error ? err.message : String(err)}`;
  }
}

function matchGlob(filename: string, glob: string): boolean {
  const regex = glob
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`).test(filename);
}

async function walkDirectory(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  results: string[],
  pattern: RegExp,
  glob: string | undefined,
  maxResults: number,
): Promise<void> {
  const entries: [string, FileSystemHandle][] = [];
  // @ts-expect-error FileSystemDirectoryHandle is async iterable in modern browsers
  for await (const [name, handle] of dir) {
    entries.push([name as string, handle as FileSystemHandle]);
  }

  for (const [name, handle] of entries) {
    if (results.length >= maxResults) return;
    const fullPath = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === 'directory') {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const subDir = await dir.getDirectoryHandle(name);
      await walkDirectory(subDir, fullPath, results, pattern, glob, maxResults);
    } else {
      if (glob && !matchGlob(name, glob)) continue;
      try {
        const fh = await dir.getFileHandle(name);
        const file = await fh.getFile();
        if (file.size > 1_000_000) continue;
        const text = await file.text();
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i]!)) {
            results.push(`${fullPath}:${i + 1}: ${lines[i]!.trim()}`);
            if (results.length >= maxResults) return;
          }
        }
      } catch {
        /* skip unreadable files */
      }
    }
  }
}

export async function fileGrep(
  pattern: string,
  glob?: string,
): Promise<string> {
  if (!directoryHandle) {
    return 'No directory selected. Ask the user to select a working directory first.';
  }
  try {
    const regex = new RegExp(pattern, 'i');
    const results: string[] = [];
    await walkDirectory(directoryHandle, '', results, regex, glob, 100);

    if (results.length === 0) {
      return `No matches found for pattern "${pattern}"${glob ? ` in files matching "${glob}"` : ''}.`;
    }
    return `Found ${results.length} match(es)${results.length >= 100 ? ' (limited to 100)' : ''}:\n${results.join('\n')}`;
  } catch (err) {
    return `Grep error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
