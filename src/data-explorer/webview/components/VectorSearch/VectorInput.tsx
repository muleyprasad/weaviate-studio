/**
 * VectorInput - Input for raw vector array
 * Allows users to paste vector embeddings directly for similarity search
 */

import React, { useCallback, useState, useMemo } from 'react';

interface VectorInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  expectedDimensions?: number;
  isSearching: boolean;
}

interface ValidationResult {
  isValid: boolean;
  dimensions: number | null;
  error: string | null;
}

// Maximum vector dimensions to prevent memory issues
const MAX_VECTOR_DIMENSIONS = 65536;

export function VectorInput({
  value,
  onChange,
  onSearch,
  expectedDimensions,
  isSearching,
}: VectorInputProps) {
  // Validate vector input
  const validation = useMemo<ValidationResult>(() => {
    if (!value.trim()) {
      return { isValid: false, dimensions: null, error: null };
    }

    try {
      const parsed = JSON.parse(value);

      if (!Array.isArray(parsed)) {
        return { isValid: false, dimensions: null, error: 'Input must be a JSON array' };
      }

      if (parsed.length === 0) {
        return { isValid: false, dimensions: 0, error: 'Vector cannot be empty' };
      }

      if (parsed.length > MAX_VECTOR_DIMENSIONS) {
        return {
          isValid: false,
          dimensions: parsed.length,
          error: `Vector exceeds maximum dimensions (${MAX_VECTOR_DIMENSIONS})`,
        };
      }

      if (!parsed.every((n) => typeof n === 'number' && !isNaN(n))) {
        return { isValid: false, dimensions: parsed.length, error: 'All elements must be numbers' };
      }

      if (expectedDimensions && parsed.length !== expectedDimensions) {
        return {
          isValid: false,
          dimensions: parsed.length,
          error: `Expected ${expectedDimensions} dimensions, got ${parsed.length}`,
        };
      }

      return { isValid: true, dimensions: parsed.length, error: null };
    } catch (e) {
      return { isValid: false, dimensions: null, error: 'Invalid JSON format' };
    }
  }, [value, expectedDimensions]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Allow search with Ctrl/Cmd + Enter for multiline input
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && validation.isValid) {
        e.preventDefault();
        onSearch();
      }
    },
    [onSearch, validation.isValid]
  );

  return (
    <div className="vector-input">
      <label htmlFor="raw-vector-input" className="input-label">
        <span className="codicon codicon-symbol-array" aria-hidden="true"></span>
        RAW VECTOR INPUT
      </label>

      <textarea
        id="raw-vector-input"
        className={`vector-textarea ${validation.error ? 'has-error' : ''} ${validation.isValid ? 'is-valid' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste vector array, e.g.:&#10;[0.123, -0.456, 0.789, ...]"
        rows={6}
        disabled={isSearching}
        spellCheck={false}
        aria-describedby="vector-validation"
      />

      <div id="vector-validation" className="vector-validation">
        {validation.error && (
          <div className="validation-error">
            <span className="codicon codicon-error" aria-hidden="true"></span>
            <span>{validation.error}</span>
          </div>
        )}

        {validation.isValid && validation.dimensions && (
          <div className="validation-success">
            <span className="codicon codicon-check" aria-hidden="true"></span>
            <span>{validation.dimensions} dimensions</span>
          </div>
        )}

        {!value.trim() && expectedDimensions && (
          <div className="dimensions-hint">
            <span className="codicon codicon-info" aria-hidden="true"></span>
            <span>Expected: {expectedDimensions} dimensions</span>
          </div>
        )}
      </div>

      <p className="input-hint">Paste a JSON array of numbers representing a vector embedding</p>
    </div>
  );
}
