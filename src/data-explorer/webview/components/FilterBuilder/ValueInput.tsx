/**
 * ValueInput - Type-specific value input component
 * Renders appropriate input control based on property data type
 * Uses debouncing to prevent excessive re-renders
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';

interface ValueInputProps {
  value: unknown;
  valueType: 'text' | 'number' | 'boolean' | 'date';
  onChange: (value: unknown) => void;
  disabled?: boolean;
  placeholder?: string;
  debounceMs?: number;
}

export function ValueInput({
  value,
  valueType,
  onChange,
  disabled = false,
  placeholder = 'Enter value...',
  debounceMs = 300,
}: ValueInputProps) {
  // Local state for immediate UI feedback
  const [localValue, setLocalValue] = useState<string>(() => {
    if (value === null || value === undefined) {
      return '';
    }
    if (valueType === 'date') {
      return formatDateForInput(value);
    }
    return String(value);
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // Sync local value with prop when prop changes externally
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const newLocalValue =
      value === null || value === undefined
        ? ''
        : valueType === 'date'
          ? formatDateForInput(value)
          : String(value);

    setLocalValue(newLocalValue);
  }, [value, valueType]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced onChange for text/number inputs
  const debouncedOnChange = useCallback(
    (newValue: unknown) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  // Handle text input change with debouncing
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalValue(val);
      debouncedOnChange(val);
    },
    [debouncedOnChange]
  );

  // Handle number input change with debouncing
  const handleNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalValue(val);

      if (val === '') {
        debouncedOnChange('');
      } else {
        const num = parseFloat(val);
        debouncedOnChange(isNaN(num) ? val : num);
      }
    },
    [debouncedOnChange]
  );

  // Handle boolean select change (no debounce needed)
  const handleBooleanChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val === 'true') {
        onChange(true);
      } else if (val === 'false') {
        onChange(false);
      } else {
        onChange('');
      }
    },
    [onChange]
  );

  // Handle date input change (no debounce needed)
  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalValue(val);

      if (val) {
        // Convert to ISO string for API
        const date = new Date(val);
        onChange(date.toISOString());
      } else {
        onChange('');
      }
    },
    [onChange]
  );

  // Render based on value type
  switch (valueType) {
    case 'boolean':
      return (
        <select
          className="filter-value-select"
          value={value === true ? 'true' : value === false ? 'false' : ''}
          onChange={handleBooleanChange}
          disabled={disabled}
        >
          <option value="">Select...</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );

    case 'number':
      return (
        <input
          type="number"
          className="filter-value-input"
          value={localValue}
          onChange={handleNumberChange}
          disabled={disabled}
          placeholder={placeholder}
          step="any"
        />
      );

    case 'date':
      return (
        <input
          type="date"
          className="filter-value-input filter-date-input"
          value={localValue}
          onChange={handleDateChange}
          disabled={disabled}
        />
      );

    case 'text':
    default:
      return (
        <input
          type="text"
          className="filter-value-input"
          value={localValue}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder={placeholder}
        />
      );
  }
}

// Helper function to format date for input (YYYY-MM-DD)
function formatDateForInput(val: unknown): string {
  if (!val) {
    return '';
  }
  try {
    const date = new Date(String(val));
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}
