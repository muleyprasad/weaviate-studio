/**
 * TenantSelectionModal - Modal for selecting a tenant when opening a multi-tenant collection
 */

import React, { useCallback, useState } from 'react';
import { useDataState, useDataActions } from '../../context';
import { getVSCodeAPI } from '../../utils/vscodeApi';
import './TenantSelectionModal.css';

export function TenantSelectionModal() {
  const dataState = useDataState();
  const dataActions = useDataActions();
  const [selectedTenant, setSelectedTenant] = useState<string>('');

  const handleSelectTenant = useCallback(() => {
    if (!selectedTenant) {
      return;
    }

    const vscode = getVSCodeAPI();
    dataActions.setLoading(true);

    vscode.postMessage({
      command: 'setTenant',
      tenant: selectedTenant,
    });
  }, [selectedTenant, dataActions]);

  const handleTenantClick = useCallback((tenantName: string) => {
    setSelectedTenant(tenantName);
  }, []);

  const handleDoubleClick = useCallback(
    (tenantName: string) => {
      const vscode = getVSCodeAPI();
      dataActions.setLoading(true);

      vscode.postMessage({
        command: 'setTenant',
        tenant: tenantName,
      });
    },
    [dataActions]
  );

  // Show modal only when:
  // - Collection is multi-tenant
  // - Tenants are loaded
  // - No tenant is selected yet
  const showModal =
    dataState.isMultiTenant && dataState.availableTenants.length > 0 && !dataState.selectedTenant;

  if (!showModal) {
    return null;
  }

  return (
    <div className="tenant-selection-modal-overlay">
      <div className="tenant-selection-modal">
        <div className="modal-header">
          <h2>
            <span className="codicon codicon-organization" aria-hidden="true"></span>
            Select Tenant
          </h2>
          <p>This is a multi-tenant collection. Please select a tenant to view its data.</p>
        </div>

        <div className="modal-body">
          <div className="tenant-list">
            {dataState.availableTenants.map((tenant) => (
              <div
                key={tenant.name}
                className={`tenant-item ${selectedTenant === tenant.name ? 'selected' : ''}`}
                onClick={() => handleTenantClick(tenant.name)}
                onDoubleClick={() => handleDoubleClick(tenant.name)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleDoubleClick(tenant.name);
                  } else if (e.key === ' ') {
                    e.preventDefault();
                    handleTenantClick(tenant.name);
                  }
                }}
              >
                <div className="tenant-name">
                  <span className="codicon codicon-organization" aria-hidden="true"></span>
                  {tenant.name}
                </div>
                {tenant.activityStatus && (
                  <div className="tenant-status">
                    <span className={`status-badge status-${tenant.activityStatus.toLowerCase()}`}>
                      {tenant.activityStatus}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="primary-button"
            onClick={handleSelectTenant}
            disabled={!selectedTenant}
          >
            Load Tenant Data
          </button>
        </div>
      </div>
    </div>
  );
}
