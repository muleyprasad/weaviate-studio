import React, { useState, useEffect } from 'react';
import { useDataExplorer } from '../../DataExplorer';
import { SearchConfigControls } from './SearchConfigControls';

/**
 * Vector Search Mode - Search using raw vector embeddings
 *
 * Uses nearVector query with a manually provided vector array
 */
export function VectorSearchMode() {
  const { state, postMessage } = useDataExplorer();
  const { schema, vectorSearch } = state;
  const [vectorInput, setVectorInput] = useState('');
  const [parsedVector, setParsedVector] = useState<number[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Expected dimensions from schema
  const expectedDimensions = schema?.vectorizers?.[0]?.dimensions || 0;

  // Parse vector input on change
  useEffect(() => {
    if (!vectorInput.trim()) {
      setParsedVector(null);
      setParseError(null);
      return;
    }

    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(vectorInput);

      if (!Array.isArray(parsed)) {
        setParseError('Vector must be an array');
        setParsedVector(null);
        return;
      }

      if (!parsed.every((v) => typeof v === 'number')) {
        setParseError('All vector values must be numbers');
        setParsedVector(null);
        return;
      }

      if (expectedDimensions > 0 && parsed.length !== expectedDimensions) {
        setParseError(
          `Expected ${expectedDimensions} dimensions, got ${parsed.length}`
        );
        setParsedVector(null);
        return;
      }

      // Valid vector
      setParsedVector(parsed);
      setParseError(null);
    } catch (err) {
      setParseError('Invalid JSON format. Expected: [0.123, -0.456, ...]');
      setParsedVector(null);
    }
  }, [vectorInput, expectedDimensions]);

  const handleSearch = () => {
    if (!parsedVector) {
      return;
    }

    // Send vector search request to extension
    postMessage({
      command: 'vectorSearch',
      data: {
        mode: 'vector',
        vectorInput: parsedVector,
        limit: vectorSearch.config.limit,
        distance: vectorSearch.config.useDistance ? vectorSearch.config.distance : undefined,
        certainty: !vectorSearch.config.useDistance ? vectorSearch.config.certainty : undefined,
      },
    });
  };

  const handlePasteExample = () => {
    // Create a simple example vector
    const exampleVector = Array.from({ length: expectedDimensions || 384 }, () =>
      (Math.random() * 2 - 1).toFixed(4)
    );
    setVectorInput(JSON.stringify(exampleVector));
  };

  return (
    <div className="vector-search-mode">
      <div className="search-input-section">
        <div className="search-label-row">
          <label htmlFor="vector-input" className="search-label">
            Paste vector{' '}
            {expectedDimensions > 0 && `(${expectedDimensions} dimensions)`}:
          </label>
          <button
            className="paste-example-button"
            onClick={handlePasteExample}
            title="Generate a random example vector"
          >
            📋 Example Vector
          </button>
        </div>
        <textarea
          id="vector-input"
          className="vector-textarea"
          placeholder={`[0.123, -0.456, 0.789, ...]${
            expectedDimensions > 0 ? ` (${expectedDimensions} numbers)` : ''
          }`}
          value={vectorInput}
          onChange={(e) => setVectorInput(e.target.value)}
          rows={6}
        />

        {/* Parse Status */}
        <div className="vector-status">
          {parseError && (
            <div className="status-error">
              <span className="error-icon">❌</span>
              <span>{parseError}</span>
            </div>
          )}
          {parsedVector && !parseError && (
            <div className="status-success">
              <span className="success-icon">✓</span>
              <span>
                Dimensions: {parsedVector.length}
                {expectedDimensions > 0 && ` / ${expectedDimensions}`}
              </span>
            </div>
          )}
        </div>

        <div className="search-hint">
          Enter a vector as a JSON array of numbers
        </div>
      </div>

      {/* Common search configuration controls */}
      <SearchConfigControls />

      <div className="search-actions">
        <button
          className="search-button primary"
          onClick={handleSearch}
          disabled={!parsedVector || vectorSearch.loading}
        >
          🔍 Search
        </button>
        <button
          className="search-button secondary"
          onClick={() => setVectorInput('')}
          disabled={!vectorInput}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
