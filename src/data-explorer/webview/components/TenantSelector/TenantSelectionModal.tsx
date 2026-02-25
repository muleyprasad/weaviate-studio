/**
 * TenantSelectionModal - Modal for selecting a tenant when opening a multi-tenant collection
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDataState, useDataActions } from '../../context';
import { getVSCodeAPI } from '../../utils/vscodeApi';
import './TenantSelectionModal.css';

export function TenantSelectionModal() {
  const dataState = useDataState();
  const dataActions = useDataActions();
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const showModal =
    dataState.isMultiTenant && dataState.availableTenants.length > 0 && !dataState.selectedTenant;

  useEffect(() => {
    if (showModal) {
      searchInputRef.current?.focus();
    }
  }, [showModal]);

  const filteredTenants = dataState.availableTenants.filter((tenant) => {
    const q = searchQuery.toLowerCase();
    return (
      tenant.name.toLowerCase().includes(q) ||
      (tenant.activityStatus ?? '').toLowerCase().includes(q)
    );
  });

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

  const handleRefresh = useCallback(() => {
    const vscode = getVSCodeAPI();
    dataActions.setLoading(true);
    vscode.postMessage({ command: 'getTenants' });
  }, [dataActions]);

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
          <div className="tenant-search-row">
            <div className="tenant-search">
              <span className="codicon codicon-search tenant-search-icon" aria-hidden="true"></span>
              <input
                ref={searchInputRef}
                type="text"
                className="tenant-search-input"
                placeholder="Search by name or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="toolbar-btn icon-btn tenant-refresh-btn"
              title="Refresh tenant list"
              aria-label="Refresh tenant list"
              onClick={handleRefresh}
            >
              ↺
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="tenant-list">
            {filteredTenants.length === 0 && (
              <div className="tenant-no-results">No tenants match your search.</div>
            )}
            {filteredTenants.map((tenant) => (
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
