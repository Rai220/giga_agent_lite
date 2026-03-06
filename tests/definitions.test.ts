import { describe, it, expect } from 'vitest';
import { ALL_FUNCTIONS } from '../src/tools/definitions';

describe('Tool Definitions', () => {
  it('exports an array of function definitions', () => {
    expect(Array.isArray(ALL_FUNCTIONS)).toBe(true);
    expect(ALL_FUNCTIONS.length).toBeGreaterThan(0);
  });

  it('each definition has name, description, and parameters', () => {
    for (const fn of ALL_FUNCTIONS) {
      expect(fn.name).toBeTruthy();
      expect(fn.description).toBeTruthy();
      expect(fn.parameters).toBeDefined();
      expect(fn.parameters.type).toBe('object');
    }
  });

  const expectedTools = [
    'execute_js', 'web_search', 'read_uploaded_file', 'list_uploaded_files',
    'current_datetime', 'think', 'critic', 'memory_save', 'memory_list',
    'memory_delete', 'create_document', 'read_csv', 'read_excel', 'read_pdf',
    'file_read', 'file_write', 'file_grep',
  ];

  it('includes all expected tools', () => {
    const names = ALL_FUNCTIONS.map((f) => f.name);
    for (const tool of expectedTools) {
      expect(names).toContain(tool);
    }
  });

  it('does NOT include generate_image', () => {
    const names = ALL_FUNCTIONS.map((f) => f.name);
    expect(names).not.toContain('generate_image');
  });

  it('has correct required fields for memory_save', () => {
    const memSave = ALL_FUNCTIONS.find((f) => f.name === 'memory_save');
    expect(memSave?.parameters.required).toEqual(['key', 'content']);
  });

  it('has correct required fields for create_document', () => {
    const createDoc = ALL_FUNCTIONS.find((f) => f.name === 'create_document');
    expect(createDoc?.parameters.required).toEqual(['filename', 'content']);
  });
});
