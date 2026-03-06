import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockStorage = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
});

import { memorySave, memoryList, memoryDelete, loadMemory, getMemoryForPrompt } from '../src/tools/memory';

describe('Agent Memory', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('saves and loads a memory entry', () => {
    memorySave('name', 'Alice');
    const store = loadMemory();
    expect(store['name']).toBeDefined();
    expect(store['name'].content).toBe('Alice');
  });

  it('lists memory entries', () => {
    memorySave('name', 'Alice');
    memorySave('lang', 'Russian');
    const result = memoryList();
    expect(result).toContain('[name]: Alice');
    expect(result).toContain('[lang]: Russian');
    expect(result).toContain('2/50');
  });

  it('deletes a memory entry', () => {
    memorySave('name', 'Alice');
    const deleted = memoryDelete('name');
    expect(deleted).toContain('Deleted');
    expect(loadMemory()['name']).toBeUndefined();
  });

  it('returns not found for non-existent key', () => {
    const result = memoryDelete('nonexistent');
    expect(result).toContain('not found');
  });

  it('updates existing entry', () => {
    memorySave('name', 'Alice');
    memorySave('name', 'Bob');
    const store = loadMemory();
    expect(store['name'].content).toBe('Bob');
  });

  it('returns empty string for prompt when no memory', () => {
    expect(getMemoryForPrompt()).toBe('');
  });

  it('returns formatted memory for prompt', () => {
    memorySave('name', 'Alice');
    const prompt = getMemoryForPrompt();
    expect(prompt).toContain('## Your memory about the user');
    expect(prompt).toContain('[name]: Alice');
  });

  it('reports empty memory', () => {
    const result = memoryList();
    expect(result).toBe('Memory is empty.');
  });
});
