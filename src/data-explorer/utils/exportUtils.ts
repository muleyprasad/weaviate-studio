/**
 * Export utilities for exporting data in various formats
 */

import type { WeaviateObject } from 'weaviate-client';
import type { ExportOptions, CollectionSchema } from '../types';

/**
 * Export data wrapper - contains metadata and objects
 */
interface ExportData {
  collection: string;
  exportedAt: string;
  totalObjects: number;
  filters?: any;
  options: ExportOptions;
  objects: WeaviateObject<Record<string, unknown>, string>[];
}

/**
 * Export objects to JSON format
 *
 * @param collectionName - Collection name
 * @param objects - Objects to export
 * @param options - Export options
 * @param schema - Collection schema
 * @returns JSON string
 */
export function exportToJSON(
  collectionName: string,
  objects: WeaviateObject<Record<string, unknown>, string>[],
  options: ExportOptions,
  schema?: CollectionSchema
): string {
  const exportData: ExportData = {
    collection: collectionName,
    exportedAt: new Date().toISOString(),
    totalObjects: objects.length,
    options,
    objects: objects.map((obj) => processObjectForExport(obj, options)),
  };

  if (schema) {
    (exportData as any).schema = {
      name: schema.name,
      properties: schema.properties,
      vectorizers: schema.vectorizers,
    };
  }

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export objects to CSV format
 *
 * @param collectionName - Collection name
 * @param objects - Objects to export
 * @param options - Export options
 * @param schema - Collection schema
 * @returns CSV string
 */
export function exportToCSV(
  collectionName: string,
  objects: WeaviateObject<Record<string, unknown>, string>[],
  options: ExportOptions,
  schema?: CollectionSchema
): string {
  if (objects.length === 0) {
    return '';
  }

  const processedObjects = objects.map((obj) => processObjectForExport(obj, options));

  // Collect all unique keys from all objects (for flattening)
  const allKeys = new Set<string>();

  processedObjects.forEach((obj) => {
    const flattened = flattenObject(obj);
    Object.keys(flattened).forEach((key) => allKeys.add(key));
  });

  const headers = Array.from(allKeys).sort();

  // Build CSV
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map((h) => escapeCSVField(h)).join(','));

  // Data rows
  processedObjects.forEach((obj) => {
    const flattened = flattenObject(obj);
    const row = headers.map((header) => {
      const value = flattened[header];
      return escapeCSVField(formatValueForCSV(value));
    });
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

/**
 * Export objects to Excel format (.xlsx)
 *
 * Note: This is a simplified implementation that creates a TSV that can be opened in Excel.
 * For a full Excel implementation, you would use a library like 'exceljs' or 'xlsx'.
 *
 * @param collectionName - Collection name
 * @param objects - Objects to export
 * @param options - Export options
 * @param schema - Collection schema
 * @returns Excel-compatible content (TSV format)
 */
export function exportToExcel(
  collectionName: string,
  objects: WeaviateObject<Record<string, unknown>, string>[],
  options: ExportOptions,
  schema?: CollectionSchema
): string {
  // For now, return TSV (tab-separated values) which Excel can open
  // In a full implementation, you'd use 'exceljs' to create a proper .xlsx file
  if (objects.length === 0) {
    return '';
  }

  const processedObjects = objects.map((obj) => processObjectForExport(obj, options));

  // Collect all unique keys
  const allKeys = new Set<string>();
  processedObjects.forEach((obj) => {
    const flattened = flattenObject(obj);
    Object.keys(flattened).forEach((key) => allKeys.add(key));
  });

  const headers = Array.from(allKeys).sort();

  // Build TSV
  const tsvRows: string[] = [];

  // Header row
  tsvRows.push(headers.join('\t'));

  // Data rows
  processedObjects.forEach((obj) => {
    const flattened = flattenObject(obj);
    const row = headers.map((header) => {
      const value = flattened[header];
      return String(formatValueForCSV(value)).replace(/\t/g, ' ');
    });
    tsvRows.push(row.join('\t'));
  });

  return tsvRows.join('\n');
}

/**
 * Export objects to Parquet format
 *
 * Note: This is a placeholder. Parquet is a binary format that requires a specialized library.
 * In a full implementation, you would use a library like 'parquetjs' or similar.
 *
 * @param collectionName - Collection name
 * @param objects - Objects to export
 * @param options - Export options
 * @param schema - Collection schema
 * @returns Error message (Parquet not implemented)
 */
export function exportToParquet(
  collectionName: string,
  objects: WeaviateObject<Record<string, unknown>, string>[],
  options: ExportOptions,
  schema?: CollectionSchema
): string {
  // Parquet requires a binary format library
  // For now, return JSON as a fallback
  console.warn('Parquet export not yet implemented, falling back to JSON');
  return exportToJSON(collectionName, objects, options, schema);
}

/**
 * Process object for export based on options
 *
 * @param obj - Weaviate object
 * @param options - Export options
 * @returns Processed object
 */
function processObjectForExport(
  obj: WeaviateObject<Record<string, unknown>, string>,
  options: ExportOptions
): any {
  const result: any = {};

  // Metadata (UUID, timestamps, etc.)
  if (options.includeMetadata) {
    result._id = obj.uuid;
    if (obj.metadata?.creationTime) {
      result._createdAt = new Date(obj.metadata.creationTime).toISOString();
    }
    if (obj.metadata?.updateTime) {
      result._updatedAt = new Date(obj.metadata.updateTime).toISOString();
    }
    if (obj.vectors && Object.keys(obj.vectors).length > 0) {
      result._vectorExists = true;
    }
  }

  // Properties
  if (options.includeProperties && obj.properties) {
    Object.assign(result, obj.properties);
  }

  // Vectors
  if (options.includeVectors && obj.vectors && Object.keys(obj.vectors).length > 0) {
    result._vectors = obj.vectors;
  }

  // References (as UUIDs)
  if (options.includeReferences && obj.properties) {
    // Extract reference properties (typically they have beacon or uuid)
    Object.entries(obj.properties).forEach(([key, value]) => {
      if (value && typeof value === 'object' && 'beacon' in value) {
        result[`${key}_ref`] = (value as any).beacon;
      }
    });
  }

  return result;
}

/**
 * Flatten nested object to dot notation
 *
 * @param obj - Object to flatten
 * @param prefix - Key prefix for recursion
 * @returns Flattened object
 */
function flattenObject(obj: any, prefix: string = ''): Record<string, any> {
  const flattened: Record<string, any> = {};

  Object.entries(obj).forEach(([key, value]) => {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      flattened[newKey] = value;
    } else if (Array.isArray(value)) {
      // Arrays as comma-separated values
      flattened[newKey] = value
        .map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
        .join(', ');
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      // Recursively flatten nested objects
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      flattened[newKey] = value;
    }
  });

  return flattened;
}

/**
 * Format value for CSV output
 *
 * @param value - Value to format
 * @returns Formatted string
 */
function formatValueForCSV(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Escape CSV field (wrap in quotes if contains special characters)
 *
 * @param field - Field value
 * @returns Escaped field
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Get file extension for export format
 *
 * @param format - Export format
 * @returns File extension
 */
export function getExportFileExtension(format: string): string {
  const extensions: Record<string, string> = {
    json: 'json',
    csv: 'csv',
    xlsx: 'xlsx',
    parquet: 'parquet',
  };
  return extensions[format] || 'txt';
}

/**
 * Get MIME type for export format
 *
 * @param format - Export format
 * @returns MIME type
 */
export function getExportMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    json: 'application/json',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    parquet: 'application/octet-stream',
  };
  return mimeTypes[format] || 'text/plain';
}
