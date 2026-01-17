import type { WeaviateObject } from 'weaviate-client';
import { PREVIEW_CONFIG } from '../constants';

/**
 * Extracts a preview text from a Weaviate object's properties
 *
 * Tries to find text in common properties (title, name, description, etc.)
 * and falls back to showing key-value pairs if no text properties found.
 *
 * @param obj - The Weaviate object to extract preview from
 * @param maxLength - Maximum length of the preview text (default: from config)
 * @returns Preview text or 'No preview available' if no suitable content found
 */
export function getObjectPreviewText(
  obj: WeaviateObject<Record<string, unknown>, string>,
  maxLength: number = PREVIEW_CONFIG.DEFAULT_MAX_LENGTH
): string {
  const props = obj.properties as Record<string, unknown>;
  if (!props) {
    return 'No preview available';
  }

  // Try common text properties in order of preference
  const textProps = ['title', 'name', 'description', 'content', 'text', 'summary'];

  for (const prop of textProps) {
    if (props[prop] && typeof props[prop] === 'string') {
      const text = props[prop] as string;
      return text.length > maxLength
        ? text.substring(0, maxLength) + '...'
        : text;
    }
  }

  // Fallback: show first few properties as key-value pairs
  const entries = Object.entries(props).slice(0, PREVIEW_CONFIG.MAX_PROPERTIES_IN_PREVIEW);
  if (entries.length === 0) {
    return 'No preview available';
  }

  return entries
    .map(([key, value]) => `${key}: ${String(value).substring(0, PREVIEW_CONFIG.PROPERTY_SNIPPET_LENGTH)}`)
    .join(' | ');
}

/**
 * Extracts a shorter preview text for inline display (e.g., in search input hints)
 *
 * @param obj - The Weaviate object to extract preview from
 * @returns Short preview text or null if no suitable content found
 */
export function getShortPreviewText(
  obj: WeaviateObject<Record<string, unknown>, string> | null | undefined
): string | null {
  if (!obj || !obj.properties) {
    return null;
  }

  const props = obj.properties as Record<string, unknown>;
  const textProps = ['title', 'name', 'description', 'content', 'text'];

  for (const prop of textProps) {
    if (props[prop] && typeof props[prop] === 'string') {
      const text = props[prop] as string;
      return text.length > PREVIEW_CONFIG.SHORT_PREVIEW_LENGTH
        ? text.substring(0, PREVIEW_CONFIG.SHORT_PREVIEW_LENGTH) + '...'
        : text;
    }
  }

  // Fallback: show first property
  const firstProp = Object.entries(props)[0];
  if (firstProp) {
    const [key, value] = firstProp;
    const snippetLength = PREVIEW_CONFIG.SHORT_PREVIEW_LENGTH / 2; // Half for fallback
    return `${key}: ${String(value).substring(0, snippetLength)}...`;
  }

  return null;
}
