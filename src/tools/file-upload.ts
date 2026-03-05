import type { UploadedFile } from '../types';

const MAX_FILE_SIZE = 512 * 1024; // 512 KB text limit
const fileStore = new Map<string, UploadedFile>();

export function addUploadedFile(file: UploadedFile): void {
  fileStore.set(file.name, file);
}

export function getUploadedFile(name: string): UploadedFile | undefined {
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

export async function readFileAsText(file: File): Promise<UploadedFile> {
  if (file.size > MAX_FILE_SIZE) {
    const partial = file.slice(0, MAX_FILE_SIZE);
    const text = await partial.text();
    return {
      name: file.name,
      content: text + `\n\n... [truncated, file is ${(file.size / 1024).toFixed(1)} KB, limit ${MAX_FILE_SIZE / 1024} KB]`,
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
