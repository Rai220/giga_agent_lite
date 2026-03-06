import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { UploadedFile } from '../types';

export function readCsv(file: UploadedFile): string {
  const result = Papa.parse(file.content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (result.errors.length > 0) {
    const errMsg = result.errors.slice(0, 3).map((e) => e.message).join('; ');
    return JSON.stringify({
      warning: `Parse warnings: ${errMsg}`,
      rowCount: result.data.length,
      columns: result.meta.fields ?? [],
      data: result.data.slice(0, 200),
    });
  }

  return JSON.stringify({
    rowCount: result.data.length,
    columns: result.meta.fields ?? [],
    data: result.data.slice(0, 200),
    truncated: result.data.length > 200,
  });
}

export function readExcel(file: UploadedFile, sheetName?: string): string {
  const binaryContent = (file as UploadedFile & { binary?: ArrayBuffer }).binary;
  if (!binaryContent) {
    return JSON.stringify({ error: 'Excel file requires binary data. Please re-upload the file.' });
  }

  try {
    const wb = XLSX.read(binaryContent, { type: 'array' });
    const targetSheet = sheetName ?? wb.SheetNames[0];
    if (!targetSheet || !wb.Sheets[targetSheet]) {
      return JSON.stringify({
        error: `Sheet "${sheetName}" not found. Available sheets: ${wb.SheetNames.join(', ')}`,
        sheets: wb.SheetNames,
      });
    }

    const ws = wb.Sheets[targetSheet]!;
    const data = XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[];
    const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[] | undefined;

    return JSON.stringify({
      sheet: targetSheet,
      allSheets: wb.SheetNames,
      rowCount: data.length,
      columns: headers ?? [],
      data: data.slice(0, 200),
      truncated: data.length > 200,
    });
  } catch (err) {
    return JSON.stringify({ error: `Failed to read Excel file: ${err instanceof Error ? err.message : String(err)}` });
  }
}

export async function readPdf(file: UploadedFile): Promise<string> {
  const binaryContent = (file as UploadedFile & { binary?: ArrayBuffer }).binary;
  if (!binaryContent) {
    return JSON.stringify({ error: 'PDF file requires binary data. Please re-upload the file.' });
  }

  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    const data = new Uint8Array(binaryContent);
    const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
    const numPages = doc.numPages;
    const textParts: string[] = [];

    const maxPages = Math.min(numPages, 50);
    for (let i = 1; i <= maxPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      textParts.push(pageText);
    }

    const fullText = textParts.join('\n\n--- Page Break ---\n\n');
    const truncatedText = fullText.length > 50000 ? fullText.slice(0, 50000) + '\n\n... [truncated]' : fullText;

    return JSON.stringify({
      pages: numPages,
      pagesRead: maxPages,
      text: truncatedText,
      truncated: numPages > maxPages || fullText.length > 50000,
    });
  } catch (err) {
    return JSON.stringify({ error: `Failed to read PDF: ${err instanceof Error ? err.message : String(err)}` });
  }
}
