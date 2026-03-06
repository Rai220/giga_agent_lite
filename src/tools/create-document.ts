import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export interface DocumentResult {
  blobUrl: string;
  filename: string;
  mimeType: string;
  size: number;
}

function createCsvBlob(content: string): Blob {
  return new Blob([content], { type: 'text/csv;charset=utf-8' });
}

function createXlsxBlob(content: string): Blob {
  let data: unknown[][];
  try {
    const parsed = JSON.parse(content) as unknown[];
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      const ws = XLSX.utils.json_to_sheet(parsed as Record<string, unknown>[]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
      return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    data = parsed as unknown[][];
  } catch {
    const rows = content.split('\n').map((row) => row.split(','));
    data = rows;
  }
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function createPdfBlob(content: string): Blob {
  const doc = new jsPDF();
  const lines = doc.splitTextToSize(content, 180) as string[];
  let y = 15;
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 15;
    }
    doc.text(line, 15, y);
    y += 7;
  }
  return doc.output('blob');
}

function createTextBlob(content: string, mime: string): Blob {
  return new Blob([content], { type: `${mime};charset=utf-8` });
}

export function createDocument(filename: string, content: string): DocumentResult {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  let blob: Blob;
  let mimeType: string;

  switch (ext) {
    case 'csv':
      blob = createCsvBlob(content);
      mimeType = 'text/csv';
      break;
    case 'xlsx':
      blob = createXlsxBlob(content);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      break;
    case 'pdf':
      blob = createPdfBlob(content);
      mimeType = 'application/pdf';
      break;
    case 'md':
      blob = createTextBlob(content, 'text/markdown');
      mimeType = 'text/markdown';
      break;
    case 'txt':
    default:
      blob = createTextBlob(content, 'text/plain');
      mimeType = 'text/plain';
      break;
  }

  const blobUrl = URL.createObjectURL(blob);
  return { blobUrl, filename, mimeType, size: blob.size };
}
