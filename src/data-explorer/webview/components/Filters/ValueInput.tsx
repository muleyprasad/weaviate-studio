/**
 * ValueInput component for entering filter values
 * Renders different input types based on data type and operator
 */

import React, { useState } from 'react';
import type { FilterOperator, FilterValue, PropertyDataType } from '../../../types';

interface ValueInputProps {
  dataType: PropertyDataType;
  operator: FilterOperator;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  disabled?: boolean;
}

export function ValueInput({
  dataType,
  operator,
  value,
  onChange,
  disabled = false,
}: ValueInputProps) {
  // Null check operators don't need a value input
  if (operator === 'isNull' || operator === 'isNotNull') {
    return <span className="value-input-placeholder">—</span>;
  }

  const baseType = dataType.replace('[]', '') as PropertyDataType;

  // Text input
  if (baseType === 'text' || baseType === 'uuid' || baseType === 'phoneNumber') {
    if (operator === 'in' || operator === 'notIn') {
      return <ArrayInput value={value} onChange={onChange} disabled={disabled} />;
    }
    return (
      <input
        type="text"
        className="value-input"
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Enter value..."
        aria-label="Filter value"
      />
    );
  }

  // Number input
  if (baseType === 'int' || baseType === 'number') {
    if (operator === 'between') {
      return <RangeInput value={value} onChange={onChange} disabled={disabled} />;
    }
    return (
      <input
        type="number"
        className="value-input"
        value={(value as number) || 0}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        placeholder="Enter number..."
        aria-label="Filter value"
      />
    );
  }

  // Boolean input
  if (baseType === 'boolean') {
    return (
      <select
        className="value-input"
        value={value === true ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value === 'true')}
        disabled={disabled}
        aria-label="Filter value"
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  // Date input
  if (baseType === 'date') {
    if (operator === 'between') {
      return <DateRangeInput value={value} onChange={onChange} disabled={disabled} />;
    }
    const dateValue = value instanceof Date ? value.toISOString().split('T')[0] : '';
    return (
      <input
        type="date"
        className="value-input"
        value={dateValue}
        onChange={(e) => {
          const date = new Date(e.target.value);
          // Only update if the date is valid
          if (!isNaN(date.getTime()) && e.target.value) {
            onChange(date);
          }
        }}
        disabled={disabled}
        aria-label="Filter value"
      />
    );
  }

  // GeoCoordinates input
  if (baseType === 'geoCoordinates' && operator === 'withinDistance') {
    return <GeoInput value={value} onChange={onChange} disabled={disabled} />;
  }

  // Default: text input
  return (
    <input
      type="text"
      className="value-input"
      value={(value as string) || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Enter value..."
      aria-label="Filter value"
    />
  );
}

/**
 * Array input for 'in' and 'notIn' operators
 */
function ArrayInput({
  value,
  onChange,
  disabled,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  disabled: boolean;
}) {
  const arrayValue = Array.isArray(value) ? value.join(', ') : '';

  return (
    <input
      type="text"
      className="value-input"
      value={arrayValue}
      onChange={(e) => {
        const values = e.target.value.split(',').map((v) => v.trim()).filter((v) => v);
        onChange(values);
      }}
      disabled={disabled}
      placeholder="value1, value2, value3..."
      aria-label="Filter values (comma-separated)"
    />
  );
}

/**
 * Range input for 'between' operator on numbers
 */
function RangeInput({
  value,
  onChange,
  disabled,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  disabled: boolean;
}) {
  const rangeValue = typeof value === 'object' && value !== null && 'min' in value
    ? (value as { min: number; max: number })
    : { min: 0, max: 100 };

  return (
    <div className="range-input">
      <input
        type="number"
        className="value-input range-min"
        value={rangeValue.min}
        onChange={(e) =>
          onChange({ ...rangeValue, min: parseFloat(e.target.value) })
        }
        disabled={disabled}
        placeholder="Min"
        aria-label="Minimum value"
      />
      <span className="range-separator">to</span>
      <input
        type="number"
        className="value-input range-max"
        value={rangeValue.max}
        onChange={(e) =>
          onChange({ ...rangeValue, max: parseFloat(e.target.value) })
        }
        disabled={disabled}
        placeholder="Max"
        aria-label="Maximum value"
      />
    </div>
  );
}

/**
 * Date range input for 'between' operator on dates
 */
function DateRangeInput({
  value,
  onChange,
  disabled,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  disabled: boolean;
}) {
  const rangeValue = typeof value === 'object' && value !== null && 'min' in value
    ? (value as { min: Date; max: Date })
    : { min: new Date(), max: new Date() };

  const minDate = rangeValue.min instanceof Date ? rangeValue.min.toISOString().split('T')[0] : '';
  const maxDate = rangeValue.max instanceof Date ? rangeValue.max.toISOString().split('T')[0] : '';

  return (
    <div className="range-input">
      <input
        type="date"
        className="value-input range-min"
        value={minDate}
        onChange={(e) => {
          const date = new Date(e.target.value);
          // Only update if the date is valid
          if (!isNaN(date.getTime()) && e.target.value) {
            onChange({ ...rangeValue, min: date });
          }
        }}
        disabled={disabled}
        aria-label="Start date"
      />
      <span className="range-separator">to</span>
      <input
        type="date"
        className="value-input range-max"
        value={maxDate}
        onChange={(e) => {
          const date = new Date(e.target.value);
          // Only update if the date is valid
          if (!isNaN(date.getTime()) && e.target.value) {
            onChange({ ...rangeValue, max: date });
          }
        }}
        disabled={disabled}
        aria-label="End date"
      />
    </div>
  );
}

/**
 * Geo coordinates input for 'withinDistance' operator
 */
function GeoInput({
  value,
  onChange,
  disabled,
}: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  disabled: boolean;
}) {
  const geoValue = typeof value === 'object' && value !== null && 'lat' in value
    ? (value as { lat: number; lon: number; distance: number })
    : { lat: 0, lon: 0, distance: 1000 };

  return (
    <div className="geo-input">
      <input
        type="number"
        className="value-input geo-lat"
        value={geoValue.lat}
        onChange={(e) =>
          onChange({ ...geoValue, lat: parseFloat(e.target.value) })
        }
        disabled={disabled}
        placeholder="Latitude"
        aria-label="Latitude"
        step="0.000001"
      />
      <input
        type="number"
        className="value-input geo-lon"
        value={geoValue.lon}
        onChange={(e) =>
          onChange({ ...geoValue, lon: parseFloat(e.target.value) })
        }
        disabled={disabled}
        placeholder="Longitude"
        aria-label="Longitude"
        step="0.000001"
      />
      <input
        type="number"
        className="value-input geo-distance"
        value={geoValue.distance}
        onChange={(e) =>
          onChange({ ...geoValue, distance: parseFloat(e.target.value) })
        }
        disabled={disabled}
        placeholder="Distance (m)"
        aria-label="Distance in meters"
      />
    </div>
  );
}
