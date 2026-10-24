/**
 * importUtils - Pure payload parsing for Data Explorer imports (Phase 6)
 *
 * No vscode / weaviate-client dependencies: safe to unit test with jest.
 *
 * Supported inputs:
 * - JSON: an array of objects, a single object, or `{ "objects": [...] }`.
 *   Per-object `id` / `_id` / `uuid` strings become the object ID;
 *   `vector` / `_vectors` number arrays become the insert vector.
 * - CSV: header row + data rows. Quoted fields, embedded commas/newlines,
 *   and `""` escapes are supported. Scalar values are coerced
 *   (integer / float / boolean); empty values are omitted.
 */

import type { ImportFormat, ImportObject } from '../types';

/** Maximum number of per-object errors kept in the result */
export const MAX_IMPORT_ERRORS = 5;

/** Maximum payload size accepted for import (10 MB of text) */
export const MAX_IMPORT_PAYLOAD_CHARS = 10 * 1024 * 1024;

export interface ParsedImport {
  objects: ImportObject[];
  /** Human-readable warnings (e.g. skipped rows); capped */
  warnings: string[];
}

const UUID_KEYS = ['id', '_id', 'uuid'];
const VECTOR_KEYS = ['vector', '_vectors', 'vectors'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number');
}

function pushWarning(warnings: string[], message: string): void {
  if (warnings.length < MAX_IMPORT_ERRORS) {
    warnings.push(message);
  }
}

/**
 * Normalizes a single raw record into an ImportObject.
 * Returns null when the record carries no usable data.
 */
function normalizeRecord(raw: unknown, label: string, warnings: string[]): ImportObject | null {
  if (!isPlainObject(raw)) {
    pushWarning(warnings, `${label}: skipped (not an object)`);
    return null;
  }

  const record: Record<string, unknown> = { ...raw };
  let id: string | undefined;
  for (const key of UUID_KEYS) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      id = value;
      break;
    }
  }
  // IDs live outside properties
  for (const key of UUID_KEYS) {
    delete record[key];
  }

  let vector: number[] | undefined;
  for (const key of VECTOR_KEYS) {
    const value = record[key];
    if (isNumberArray(value) && value.length > 0) {
      vector = value;
      delete record[key];
      break;
    }
  }

  // Drop undefined values; keep everything else as-is
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) {
      properties[key] = value;
    }
  }

  if (Object.keys(properties).length === 0 && !vector && !id) {
    pushWarning(warnings, `${label}: skipped (no properties)`);
    return null;
  }

  return { id, properties, vector };
}

/**
 * Parses a JSON import payload.
 */
export function parseJsonImport(text: string): ParsedImport {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON: unable to parse payload');
  }

  let records: unknown[];
  if (Array.isArray(parsed)) {
    records = parsed;
  } else if (isPlainObject(parsed) && Array.isArray((parsed as Record<string, unknown>).objects)) {
    records = (parsed as Record<string, unknown>).objects as unknown[];
  } else if (isPlainObject(parsed)) {
    records = [parsed];
  } else {
    throw new Error(
      'Invalid JSON: expected an array of objects, a single object, or { "objects": [...] }'
    );
  }

  if (records.length === 0) {
    throw new Error('Import payload contains no objects');
  }

  const objects: ImportObject[] = [];
  records.forEach((record, index) => {
    const normalized = normalizeRecord(record, `Item ${index + 1}`, warnings);
    if (normalized) {
      objects.push(normalized);
    }
  });

  if (objects.length === 0) {
    throw new Error('Import payload contains no usable objects');
  }

  return { objects, warnings };
}

/**
 * Splits CSV text into rows of fields.
 * Supports quoted fields, `""` escapes, and newlines inside quotes.
 */
export function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (char === '\r') {
      // Ignore; \n handles the line break
    } else {
      field += char;
    }
  }
  // Flush trailing content (also catches unterminated quotes gracefully)
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Coerces a CSV cell to integer / float / boolean when unambiguous.
 * Empty cells become undefined so the property is omitted.
 */
export function coerceCsvValue(raw: string): unknown {
  const value = raw.trim();
  if (value === '') {
    return undefined;
  }
  const lower = value.toLowerCase();
  if (lower === 'true') {
    return true;
  }
  if (lower === 'false') {
    return false;
  }
  if (/^-?\d+$/.test(value)) {
    // Keep leading-zero codes (e.g. zip codes) as strings
    if (/^-?0\d/.test(value)) {
      return value;
    }
    const num = Number(value);
    if (Number.isSafeInteger(num)) {
      return num;
    }
    return value;
  }
  if (/^-?(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?$/.test(value) && value !== '-') {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num;
    }
  }
  return value;
}

/**
 * Parses a CSV import payload. The first non-empty row is the header.
 */
export function parseCsvImport(text: string): ParsedImport {
  const warnings: string[] = [];
  const rows = splitCsvRows(text).filter((row) => row.some((cell) => cell.trim() !== ''));

  if (rows.length === 0) {
    throw new Error('Import payload contains no rows');
  }

  const headers = rows[0].map((h) => h.trim());
  if (headers.length === 0 || headers.every((h) => h === '')) {
    throw new Error('CSV is missing a header row');
  }

  const objects: ImportObject[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const properties: Record<string, unknown> = {};
    headers.forEach((header, col) => {
      if (!header) {
        return;
      }
      const coerced = coerceCsvValue(row[col] ?? '');
      if (coerced !== undefined) {
        properties[header] = coerced;
      }
    });
    const normalized = normalizeRecord(properties, `Row ${i + 1}`, warnings);
    if (normalized) {
      // CSV id columns flow through normalizeRecord's UUID handling
      objects.push(normalized);
    }
  }

  if (objects.length === 0) {
    throw new Error('Import payload contains no usable rows');
  }

  return { objects, warnings };
}

/**
 * Parses an import payload of the given format.
 * Throws on empty payloads, oversize payloads, and unusable content.
 */
export function parseImportPayload(text: string, format: ImportFormat): ParsedImport {
  if (!text || text.trim() === '') {
    throw new Error('Import payload is empty');
  }
  if (text.length > MAX_IMPORT_PAYLOAD_CHARS) {
    throw new Error('Import payload exceeds the 10 MB limit');
  }
  return format === 'json' ? parseJsonImport(text) : parseCsvImport(text);
}
