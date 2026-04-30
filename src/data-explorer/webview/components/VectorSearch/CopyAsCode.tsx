/**
 * CopyAsCode - Generate and copy SDK code snippets for current search configuration
 * Supports TypeScript and Python output
 */

import React, { useCallback, useState } from 'react';
import type { MultiTargetPayload } from '../../../types';
import type { VectorSearchParameters } from '../../context';
import './CopyAsCode.css';

interface CopyAsCodeProps {
  collectionName: string;
  searchMode: 'text' | 'object' | 'vector' | 'hybrid';
  searchParams: VectorSearchParameters;
  targetVector?: string | MultiTargetPayload;
  disabled?: boolean;
}

type Language = 'typescript' | 'python';

function generateTypeScriptSnippet(
  collectionName: string,
  searchMode: string,
  searchParams: VectorSearchParameters,
  targetVector?: string | MultiTargetPayload
): string {
  const lines: string[] = [];

  lines.push('import weaviate from "weaviate-client";');
  lines.push('');
  lines.push('const client = weaviate.connectToLocal();');
  lines.push(`const collection = client.collections.get("${collectionName}");`);
  lines.push('');
  lines.push('const results = await collection');

  if (searchMode === 'text') {
    lines.push(`  .query.nearText("${searchParams.query}", {`);
  } else if (searchMode === 'hybrid') {
    lines.push(`  .query.hybrid("${searchParams.query}", {`);
    lines.push(`    alpha: ${searchParams.hybridAlpha},`);
  } else if (searchMode === 'object') {
    lines.push(`  .query.nearObject("${searchParams.objectId}", {`);
  } else if (searchMode === 'vector') {
    lines.push('  .query.nearVector([...], {');
  }

  if (targetVector && typeof targetVector === 'object') {
    const payload = targetVector as MultiTargetPayload;
    lines.push(
      `    targetVectors: [${payload.targetVectors.map((v: string) => `"${v}"`).join(', ')}],`
    );
    lines.push(`    join: collection.multiTargetVector.${payload.combination}(),`);
    if (payload.weights) {
      const weightsStr = Object.entries(payload.weights)
        .map(([v, w]) => `"${v}": ${w}`)
        .join(', ');
      lines.push(`    weights: { ${weightsStr} },`);
    }
  } else if (targetVector && typeof targetVector === 'string') {
    lines.push(`    targetVector: "${targetVector}",`);
  }

  lines.push(`    limit: ${searchParams.limit},`);
  if (searchParams.certainty) {
    lines.push(`    certainty: ${searchParams.certainty},`);
  }
  lines.push('  });');
  lines.push('');
  lines.push('console.log(results);');

  return lines.join('\n');
}

function generatePythonSnippet(
  collectionName: string,
  searchMode: string,
  searchParams: VectorSearchParameters,
  targetVector?: string | MultiTargetPayload
): string {
  const lines: string[] = [];

  lines.push('import weaviate');
  lines.push('from weaviate.classes.query import Move');
  lines.push('');
  lines.push('client = weaviate.connect_to_local()');
  lines.push(`collection = client.collections.get("${collectionName}")`);
  lines.push('');

  const queryParams: string[] = [];
  queryParams.push(`limit=${searchParams.limit}`);

  if (searchParams.certainty) {
    queryParams.push(`certainty=${searchParams.certainty}`);
  }

  if (targetVector && typeof targetVector === 'object') {
    const payload = targetVector as MultiTargetPayload;
    const targetsStr = '[' + payload.targetVectors.map((v: string) => `"${v}"`).join(', ') + ']';
    queryParams.push(`target_vectors=${targetsStr}`);
    queryParams.push(`join_strategy="${payload.combination}"`);
    if (payload.weights) {
      const weightsStr =
        '{' +
        Object.entries(payload.weights)
          .map(([v, w]) => `"${v}": ${w}`)
          .join(', ') +
        '}';
      queryParams.push(`weights=${weightsStr}`);
    }
  } else if (targetVector && typeof targetVector === 'string') {
    queryParams.push(`target_vector="${targetVector}"`);
  }

  if (searchMode === 'text') {
    lines.push(`results = collection.query.near_text(`);
    lines.push(`    "${searchParams.query}",`);
  } else if (searchMode === 'hybrid') {
    lines.push(`results = collection.query.hybrid(`);
    lines.push(`    "${searchParams.query}",`);
    queryParams.push(`alpha=${searchParams.hybridAlpha}`);
  } else if (searchMode === 'object') {
    lines.push(`results = collection.query.near_object(`);
    lines.push(`    "${searchParams.objectId}",`);
  }

  lines.push(`    ${queryParams.join(',\n    ')}`);
  lines.push(').objects');
  lines.push('');
  lines.push('for obj in results:');
  lines.push('    print(obj)');

  return lines.join('\n');
}

export function CopyAsCode({
  collectionName,
  searchMode,
  searchParams,
  targetVector,
  disabled = false,
}: CopyAsCodeProps) {
  const [language, setLanguage] = useState<Language>('typescript');
  const [copied, setCopied] = useState(false);

  const generateSnippet = useCallback((): string => {
    if (language === 'typescript') {
      return generateTypeScriptSnippet(collectionName, searchMode, searchParams, targetVector);
    } else {
      return generatePythonSnippet(collectionName, searchMode, searchParams, targetVector);
    }
  }, [collectionName, searchMode, searchParams, targetVector, language]);

  const handleCopyCode = useCallback(async () => {
    try {
      const snippet = generateSnippet();
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [generateSnippet]);

  return (
    <div className="copy-as-code">
      <button
        className="copy-as-code-btn"
        onClick={handleCopyCode}
        disabled={disabled}
        title="Copy generated code to clipboard"
      >
        {copied ? '✓ Copied!' : '📋 Copy as Code'}
      </button>

      <select
        className="copy-as-code-language"
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        disabled={disabled}
        aria-label="Select code language"
      >
        <option value="typescript">TypeScript</option>
        <option value="python">Python</option>
      </select>
    </div>
  );
}
