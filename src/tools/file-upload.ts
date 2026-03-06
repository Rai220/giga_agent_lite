import type { UploadedFile } from '../types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB for binary files
const MAX_TEXT_SIZE = 512 * 1024; // 512 KB text limit
const fileStore = new Map<string, UploadedFile & { binary?: ArrayBuffer }>();

const BINARY_EXTENSIONS = new Set([
  'xlsx', 'xls', 'pdf', 'doc', 'docx', 'ppt', 'pptx',
  'zip', 'gz', 'tar', 'png', 'jpg', 'jpeg', 'gif', 'webp',
]);

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

export function addUploadedFile(file: UploadedFile & { binary?: ArrayBuffer }): void {
  fileStore.set(file.name, file);
}

export function getUploadedFile(name: string): (UploadedFile & { binary?: ArrayBuffer }) | undefined {
  return fileStore.get(name);
}

export function listUploadedFiles(): UploadedFile[] {
  return Array.from(fileStore.values());
}

export function removeUploadedFile(name: string): boolean {
  return fileStore.delete(name);
}

export function clearUploadedFiles(): void {
  fileStore.clear();
}

export async function readFileAsText(file: File): Promise<UploadedFile & { binary?: ArrayBuffer }> {
  const ext = getExtension(file.name);
  const isBinary = BINARY_EXTENSIONS.has(ext);

  if (isBinary) {
    if (file.size > MAX_FILE_SIZE) {
      return {
        name: file.name,
        content: `[Binary file: ${file.name}, ${(file.size / 1024).toFixed(1)} KB — too large, max ${MAX_FILE_SIZE / (1024 * 1024)} MB]`,
        size: file.size,
        type: file.type || 'application/octet-stream',
      };
    }
    const buffer = await file.arrayBuffer();
    return {
      name: file.name,
      content: `[Binary file: ${file.name}, ${(file.size / 1024).toFixed(1)} KB, type: ${file.type || ext}]`,
      size: file.size,
      type: file.type || 'application/octet-stream',
      binary: buffer,
    };
  }

  if (file.size > MAX_TEXT_SIZE) {
    const partial = file.slice(0, MAX_TEXT_SIZE);
    const text = await partial.text();
    return {
      name: file.name,
      content: text + `\n\n... [truncated, file is ${(file.size / 1024).toFixed(1)} KB, limit ${MAX_TEXT_SIZE / 1024} KB]`,
      size: file.size,
      type: file.type || 'text/plain',
    };
  }
  const text = await file.text();
  return {
    name: file.name,
    content: text,
    size: file.size,
    type: file.type || 'text/plain',
  };
}
