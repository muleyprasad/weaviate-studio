/**
 * OperatorSelector component for choosing a filter operator
 */

import React from 'react';
import type { FilterOperator, PropertyDataType } from '../../../types';
import { getOperatorsForType, getOperatorLabel } from '../../../utils/filterUtils';

interface OperatorSelectorProps {
  dataType: PropertyDataType;
  selectedOperator: FilterOperator;
  onChange: (operator: FilterOperator) => void;
  disabled?: boolean;
}

export function OperatorSelector({
  dataType,
  selectedOperator,
  onChange,
  disabled = false,
}: OperatorSelectorProps) {
  const availableOperators = getOperatorsForType(dataType);

  return (
    <select
      className="operator-selector"
      value={selectedOperator}
      onChange={(e) => onChange(e.target.value as FilterOperator)}
      disabled={disabled}
      aria-label="Select filter operator"
    >
      {availableOperators.map((operator) => (
        <option key={operator} value={operator}>
          {getOperatorLabel(operator)}
        </option>
      ))}
    </select>
  );
}
