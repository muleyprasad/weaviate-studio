/**
 * Hook to extract named vector information from collection schema
 * Detects MUVERA encoding, multi-vector flags, vectorizer names, etc.
 */

import { useMemo } from 'react';
import type { CollectionConfig, NamedVectorInfo } from '../../types';

interface UseNamedVectorsResult {
  namedVectors: NamedVectorInfo[];
  hasMultipleVectors: boolean;
  vectorCount: number;
}

/**
 * Extract and analyze named vector information from collection schema
 * @param schema - Collection configuration from Weaviate
 * @returns Object with named vectors list and utility flags
 */
export function useNamedVectors(schema: CollectionConfig | null): UseNamedVectorsResult {
  return useMemo(() => {
    if (!schema || !schema.vectorizerConfig) {
      return {
        namedVectors: [],
        hasMultipleVectors: false,
        vectorCount: 0,
      };
    }

    const vectorizerConfig = schema.vectorizerConfig as Record<string, any>;
    const namedVectors: NamedVectorInfo[] = [];

    // Iterate through each named vector in the config
    Object.entries(vectorizerConfig).forEach(([vectorName, vectorConfig]) => {
      if (!vectorConfig || typeof vectorConfig !== 'object') {
        return;
      }

      const config = vectorConfig as Record<string, any>;

      // Extract vectorizer name/module.
      // The weaviate-client returns vectorizer as a ModuleConfig object { name, config },
      // not a plain string, so we must extract the .name property.
      const vectorizerRaw = config.vectorizer;
      const vectorizerName =
        vectorizerRaw && typeof vectorizerRaw === 'object' && 'name' in vectorizerRaw
          ? String((vectorizerRaw as { name: unknown }).name)
          : typeof vectorizerRaw === 'string'
            ? vectorizerRaw
            : 'unknown';

      // Extract index configuration
      const indexType = config.indexType || 'unknown';
      const indexConfig = config.indexConfig || {};

      // Detect MUVERA encoding
      // MUVERA is indicated by multiVector.encoding.type === 'muvera'
      const multiVectorConfig = indexConfig.multiVector;
      const isMuvera =
        multiVectorConfig?.encoding?.type === 'muvera' || multiVectorConfig?.type === 'muvera';

      // Detect if this is a multi-vector configuration
      const isMultiVector = multiVectorConfig !== undefined;

      // Extract properties if available
      const properties = config.properties as string[] | undefined;

      namedVectors.push({
        name: vectorName,
        vectorizerName,
        vectorizerConfig: config,
        indexType,
        indexConfig,
        isMuvera,
        isMultiVector,
        properties,
      });
    });

    return {
      namedVectors,
      hasMultipleVectors: namedVectors.length > 1,
      vectorCount: namedVectors.length,
    };
  }, [schema]);
}
