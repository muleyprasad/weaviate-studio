/**
 * FilterRule - Single filter row component
 * Displays property selector, operator dropdown, and value input
 */

import React, { useCallback, useMemo } from 'react';
import type { FilterCondition, FilterOperator } from '../../context';
import type { PropertyConfig } from '../../../types';
import { ValueInput } from './ValueInput';
import { getOperatorsForType, getValueType } from './filterUtils';

interface FilterRuleProps {
  filter: FilterCondition;
  properties: PropertyConfig[];
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
}

export function FilterRule({ filter, properties, onUpdate, onRemove }: FilterRuleProps) {
  // Get the selected property config
  const selectedProperty = useMemo(
    () => properties.find((p) => p.name === filter.path),
    [properties, filter.path]
  );

  // Get the data type for the selected property
  const dataType = useMemo(() => {
    if (!selectedProperty) {
      return 'text';
    }
    return selectedProperty.dataType?.[0] || 'text';
  }, [selectedProperty]);

  // Get available operators for the property type
  const availableOperators = useMemo(() => getOperatorsForType(dataType), [dataType]);

  // Check if current operator requires a value
  const operatorRequiresValue = useMemo(() => {
    const op = availableOperators.find((o) => o.value === filter.operator);
    return op?.requiresValue ?? true;
  }, [availableOperators, filter.operator]);

  // Handle property change
  const handlePropertyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newPath = e.target.value;
      const newProperty = properties.find((p) => p.name === newPath);
      const newDataType = newProperty?.dataType?.[0] || 'text';
      const newValueType = getValueType(newDataType);

      // Reset operator and value when property changes
      const operators = getOperatorsForType(newDataType);
      const defaultOperator = operators[0]?.value || 'Equal';

      onUpdate({
        path: newPath,
        operator: defaultOperator,
        value: '',
        valueType: newValueType,
      });
    },
    [properties, onUpdate]
  );

  // Handle operator change
  const handleOperatorChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newOperator = e.target.value as FilterOperator;
      const op = availableOperators.find((o) => o.value === newOperator);

      // Clear value if new operator doesn't require one
      if (!op?.requiresValue) {
        onUpdate({ operator: newOperator, value: null });
      } else {
        onUpdate({ operator: newOperator });
      }
    },
    [availableOperators, onUpdate]
  );

  // Handle value change
  const handleValueChange = useCallback(
    (value: unknown) => {
      onUpdate({ value });
    },
    [onUpdate]
  );

  // Get filterable properties only (those that are indexed)
  const filterableProperties = useMemo(
    () =>
      properties.filter((p) => {
        // Include all properties for now, but could filter to indexFilterable only
        return true;
      }),
    [properties]
  );

  return (
    <div className="filter-rule">
      {/* Property selector */}
      <select
        className="filter-property-select"
        value={filter.path}
        onChange={handlePropertyChange}
        aria-label="Select property to filter"
      >
        <option value="">Select property...</option>
        {filterableProperties.map((prop) => (
          <option key={prop.name} value={prop.name}>
            {prop.name}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        className="filter-operator-select"
        value={filter.operator}
        onChange={handleOperatorChange}
        disabled={!filter.path}
        aria-label="Select filter operator"
      >
        {availableOperators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value input */}
      {operatorRequiresValue && (
        <ValueInput
          value={filter.value}
          valueType={filter.valueType || 'text'}
          onChange={handleValueChange}
          disabled={!filter.path}
          placeholder="Enter value..."
        />
      )}

      {/* Spacer when no value input */}
      {!operatorRequiresValue && <div className="filter-value-spacer" />}

      {/* Remove button */}
      <button
        type="button"
        className="filter-remove-btn"
        onClick={onRemove}
        title="Remove filter"
        aria-label="Remove this filter"
      >
        <span className="codicon codicon-close" aria-hidden="true">
          ×
        </span>
      </button>
    </div>
  );
}
