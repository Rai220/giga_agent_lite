import { describe, it, expect } from 'vitest';
import { readCsv } from '../src/tools/read-files';
import type { UploadedFile } from '../src/types';

describe('readCsv', () => {
  it('parses a simple CSV file', () => {
    const file: UploadedFile = {
      name: 'test.csv',
      content: 'name,age,city\nAlice,30,Moscow\nBob,25,London',
      size: 45,
      type: 'text/csv',
    };
    const result = JSON.parse(readCsv(file));
    expect(result.rowCount).toBe(2);
    expect(result.columns).toEqual(['name', 'age', 'city']);
    expect(result.data[0].name).toBe('Alice');
    expect(result.data[0].age).toBe(30);
    expect(result.data[1].city).toBe('London');
  });

  it('handles empty CSV', () => {
    const file: UploadedFile = {
      name: 'empty.csv',
      content: '',
      size: 0,
      type: 'text/csv',
    };
    const result = JSON.parse(readCsv(file));
    expect(result.rowCount).toBe(0);
  });

  it('handles CSV with only headers', () => {
    const file: UploadedFile = {
      name: 'headers.csv',
      content: 'col1,col2,col3',
      size: 14,
      type: 'text/csv',
    };
    const result = JSON.parse(readCsv(file));
    expect(result.columns).toEqual(['col1', 'col2', 'col3']);
    expect(result.rowCount).toBe(0);
  });

  it('handles CSV with semicolon delimiter', () => {
    const file: UploadedFile = {
      name: 'semi.csv',
      content: 'name;age\nAlice;30',
      size: 20,
      type: 'text/csv',
    };
    const result = JSON.parse(readCsv(file));
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
  });

  it('truncates large data to 200 rows', () => {
    const header = 'id,value';
    const rows = Array.from({ length: 300 }, (_, i) => `${i},${i * 10}`).join('\n');
    const file: UploadedFile = {
      name: 'large.csv',
      content: `${header}\n${rows}`,
      size: 5000,
      type: 'text/csv',
    };
    const result = JSON.parse(readCsv(file));
    expect(result.data.length).toBe(200);
    expect(result.truncated).toBe(true);
    expect(result.rowCount).toBe(300);
  });
});
