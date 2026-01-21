/**
 * ValueInput - Type-specific value input component
 * Renders appropriate input control based on property data type
 */

import React, { useCallback } from 'react';

interface ValueInputProps {
  value: unknown;
  valueType: 'text' | 'number' | 'boolean' | 'date';
  onChange: (value: unknown) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ValueInput({
  value,
  valueType,
  onChange,
  disabled = false,
  placeholder = 'Enter value...',
}: ValueInputProps) {
  // Handle text input change
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Handle number input change
  const handleNumberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === '') {
        onChange('');
      } else {
        const num = parseFloat(val);
        onChange(isNaN(num) ? val : num);
      }
    },
    [onChange]
  );

  // Handle boolean select change
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

  // Handle date input change
  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
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

  // Format date value for input (YYYY-MM-DD)
  const formatDateForInput = (val: unknown): string => {
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
  };

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
          value={value !== null && value !== undefined ? String(value) : ''}
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
          value={formatDateForInput(value)}
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
          value={value !== null && value !== undefined ? String(value) : ''}
          onChange={handleTextChange}
          disabled={disabled}
          placeholder={placeholder}
        />
      );
  }
}
