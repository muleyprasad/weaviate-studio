/**
 * TenantSelector - Dropdown for selecting tenant in multi-tenant collections
 */

import React, { useCallback } from 'react';
import { useDataState, useDataActions } from '../../context';
import { getVSCodeAPI } from '../../utils/vscodeApi';
import './TenantSelector.css';

export function TenantSelector() {
  const dataState = useDataState();
  const dataActions = useDataActions();

  const handleTenantChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const tenant = event.target.value;
      const vscode = getVSCodeAPI();

      // Set loading state
      dataActions.setLoading(true);

      // Send message to extension to change tenant
      vscode.postMessage({
        command: 'setTenant',
        tenant: tenant || undefined,
      });
    },
    [dataActions]
  );

  // Don't show if not multi-tenant
  if (!dataState.isMultiTenant || dataState.availableTenants.length === 0) {
    return null;
  }

  return (
    <div className="tenant-selector">
      <label htmlFor="tenant-select" className="tenant-label">
        <span className="codicon codicon-organization" aria-hidden="true"></span>
        Tenant:
      </label>
      <select
        id="tenant-select"
        className="tenant-select"
        value={dataState.selectedTenant || ''}
        onChange={handleTenantChange}
        disabled={dataState.loading}
      >
        <option value="" disabled>
          Select a tenant...
        </option>
        {dataState.availableTenants.map((tenant) => (
          <option key={tenant.name} value={tenant.name}>
            {tenant.name} {tenant.activityStatus && `(${tenant.activityStatus})`}
          </option>
        ))}
      </select>
    </div>
  );
}
