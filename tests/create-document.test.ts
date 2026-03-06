import { describe, it, expect, vi, beforeAll } from 'vitest';

const blobStore: Blob[] = [];
let blobCounter = 0;

vi.stubGlobal('URL', {
  createObjectURL: (blob: Blob) => {
    blobStore.push(blob);
    return `blob:test/${blobCounter++}`;
  },
  revokeObjectURL: () => {},
});

import { createDocument } from '../src/tools/create-document';

describe('createDocument', () => {
  beforeAll(() => {
    blobStore.length = 0;
    blobCounter = 0;
  });

  it('creates a CSV document', () => {
    const result = createDocument('test.csv', 'a,b,c\n1,2,3');
    expect(result.filename).toBe('test.csv');
    expect(result.mimeType).toBe('text/csv');
    expect(result.blobUrl).toMatch(/^blob:/);
    expect(result.size).toBeGreaterThan(0);
  });

  it('creates a TXT document', () => {
    const result = createDocument('notes.txt', 'Hello world');
    expect(result.filename).toBe('notes.txt');
    expect(result.mimeType).toBe('text/plain');
    expect(result.size).toBe(11);
  });

  it('creates a Markdown document', () => {
    const result = createDocument('readme.md', '# Title\n\nContent');
    expect(result.filename).toBe('readme.md');
    expect(result.mimeType).toBe('text/markdown');
  });

  it('creates an XLSX document from JSON array', () => {
    const data = JSON.stringify([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
    const result = createDocument('people.xlsx', data);
    expect(result.filename).toBe('people.xlsx');
    expect(result.mimeType).toContain('spreadsheetml');
    expect(result.size).toBeGreaterThan(0);
  });

  it('creates an XLSX document from CSV text', () => {
    const result = createDocument('data.xlsx', 'Name,Age\nAlice,30\nBob,25');
    expect(result.filename).toBe('data.xlsx');
    expect(result.mimeType).toContain('spreadsheetml');
  });

  it('creates a PDF document', () => {
    const result = createDocument('report.pdf', 'This is a test PDF document with some content.');
    expect(result.filename).toBe('report.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.size).toBeGreaterThan(0);
  });

  it('defaults to text/plain for unknown extension', () => {
    const result = createDocument('data.xyz', 'some data');
    expect(result.mimeType).toBe('text/plain');
  });
});
