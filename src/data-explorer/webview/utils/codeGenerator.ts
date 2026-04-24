/**
 * Code generation utilities for multi-target vector search
 * Generates TypeScript and Python SDK code snippets
 */

import type { MultiTargetPayload } from '../../types';
import type { VectorSearchParameters } from '../context';

/**
 * Generate TypeScript code snippet for current search configuration
 */
export function generateTypeScriptSnippet(params: {
  collectionName: string;
  searchMode: string;
  searchParams: VectorSearchParameters;
  targetVector?: string | MultiTargetPayload;
}): string {
  const { collectionName, searchMode, searchParams, targetVector } = params;
  const lines: string[] = [];

  lines.push('import weaviate from "weaviate-client";');
  lines.push('');
  lines.push('const client = weaviate.connectToLocal();');
  lines.push(`const collection = client.collections.get("${collectionName}");`);
  lines.push('');
  lines.push('const results = await collection.query');

  // Query method and initial parameters
  if (searchMode === 'text') {
    lines.push(`  .nearText("${escapeString(searchParams.query)}", {`);
  } else if (searchMode === 'hybrid') {
    lines.push(`  .hybrid("${escapeString(searchParams.query)}", {`);
  } else if (searchMode === 'object') {
    lines.push(`  .nearObject("${searchParams.objectId}", {`);
  } else if (searchMode === 'vector') {
    lines.push('  .nearVector([/* vector values */], {');
  } else {
    lines.push('  .fetchObjects({');
  }

  // Build query options
  const options: string[] = [];

  // Add hybrid alpha if applicable
  if (searchMode === 'hybrid') {
    options.push(`    alpha: ${searchParams.hybridAlpha}`);
  }

  // Add target vector or multi-target configuration
  if (targetVector) {
    if (typeof targetVector === 'string') {
      options.push(`    targetVector: "${targetVector}"`);
    } else {
      const mtPayload = targetVector as MultiTargetPayload;
      const vectors = mtPayload.targetVectors.map((v: string) => `"${v}"`).join(', ');
      options.push(`    targetVectors: [${vectors}]`);

      // Add join strategy
      const joinMethod = getJoinMethodName(mtPayload.combination);
      options.push(`    joinStrategy: collection.multiTargetVector.${joinMethod}()`);

      // Add weights if present
      if (mtPayload.weights && Object.keys(mtPayload.weights).length > 0) {
        const weightsStr = Object.entries(mtPayload.weights)
          .map(([v, w]: [string, any]) => `"${v}": ${Number(w).toFixed(3)}`)
          .join(', ');
        options.push(`    weights: { ${weightsStr} }`);
      }
    }
  }

  // Add common options
  if (searchParams.certainty) {
    options.push(`    certainty: ${searchParams.certainty}`);
  }
  if (searchParams.distance) {
    options.push(`    distance: ${searchParams.distance}`);
  }
  options.push(`    limit: ${searchParams.limit}`);

  // Combine options
  if (options.length > 0) {
    lines.push(options.join(',\n') + ',');
  }

  lines.push('  })');
  lines.push('  .withLimit(' + searchParams.limit + ')');
  lines.push('  .do();');
  lines.push('');
  lines.push('console.log(results);');

  return lines.join('\n');
}

/**
 * Generate Python code snippet for current search configuration
 */
export function generatePythonSnippet(params: {
  collectionName: string;
  searchMode: string;
  searchParams: VectorSearchParameters;
  targetVector?: string | MultiTargetPayload;
}): string {
  const { collectionName, searchMode, searchParams, targetVector } = params;
  const lines: string[] = [];

  lines.push('import weaviate');
  lines.push('');
  lines.push('client = weaviate.connect_to_local()');
  lines.push(`collection = client.collections.get("${collectionName}")`);
  lines.push('');

  // Query method
  let queryCall = '';
  const queryArgs: string[] = [];

  if (searchMode === 'text') {
    queryCall = 'near_text';
    queryArgs.push(`"${escapeString(searchParams.query)}"`);
  } else if (searchMode === 'hybrid') {
    queryCall = 'hybrid';
    queryArgs.push(`"${escapeString(searchParams.query)}"`);
  } else if (searchMode === 'object') {
    queryCall = 'near_object';
    queryArgs.push(`"${searchParams.objectId}"`);
  } else if (searchMode === 'vector') {
    queryCall = 'near_vector';
    queryArgs.push('[/* vector values */]');
  } else {
    queryCall = 'fetch_objects';
  }

  // Build query kwargs
  const kwargs: string[] = [];

  if (searchMode === 'hybrid') {
    kwargs.push(`alpha=${searchParams.hybridAlpha}`);
  }

  if (targetVector) {
    if (typeof targetVector === 'string') {
      kwargs.push(`target_vector="${targetVector}"`);
    } else {
      const mtPayload = targetVector as MultiTargetPayload;
      const vectors = '[' + mtPayload.targetVectors.map((v: string) => `"${v}"`).join(', ') + ']';
      kwargs.push(`target_vectors=${vectors}`);
      kwargs.push(`join_strategy="${mtPayload.combination}"`);

      if (mtPayload.weights && Object.keys(mtPayload.weights).length > 0) {
        const weightsStr =
          '{' +
          Object.entries(mtPayload.weights)
            .map(([v, w]: [string, any]) => `"${v}": ${Number(w).toFixed(3)}`)
            .join(', ') +
          '}';
        kwargs.push(`weights=${weightsStr}`);
      }
    }
  }

  if (searchParams.certainty) {
    kwargs.push(`certainty=${searchParams.certainty}`);
  }
  if (searchParams.distance) {
    kwargs.push(`distance=${searchParams.distance}`);
  }
  kwargs.push(`limit=${searchParams.limit}`);

  // Build the query call
  if (queryArgs.length > 0) {
    lines.push(`results = collection.query.${queryCall}(`);
    lines.push(`    ${queryArgs.join(',\n    ')},`);
    if (kwargs.length > 0) {
      lines.push(`    ${kwargs.join(',\n    ')}`);
    }
    lines.push(').objects');
  } else {
    lines.push(`results = collection.query.${queryCall}(`);
    if (kwargs.length > 0) {
      lines.push(`    ${kwargs.join(',\n    ')}`);
    }
    lines.push(').objects');
  }

  lines.push('');
  lines.push('for obj in results:');
  lines.push('    print(obj)');

  return lines.join('\n');
}

/**
 * Escape string for code generation
 */
function escapeString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Map join strategy to SDK method name
 */
function getJoinMethodName(strategy: string): string {
  switch (strategy) {
    case 'minimum':
      return 'minimum()';
    case 'sum':
      return 'sum()';
    case 'average':
      return 'average()';
    case 'manual-weights':
      return 'manualWeights()';
    case 'relative-score':
      return 'relativeScore()';
    default:
      return 'minimum()';
  }
}
