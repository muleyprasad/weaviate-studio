import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './ManageTenants.css';
import { matchTenantNames, TenantMatchMode } from '../utils/tenantMatch';
import { parseCountFilter } from '../utils/countFilter';

let vscode: any;
try {
  vscode = window.acquireVsCodeApi();
} catch (error) {
  console.error('Failed to acquire VS Code API', error);
}

type ActivityStatus = 'ACTIVE' | 'INACTIVE' | 'OFFLOADED' | 'OFFLOADING' | 'ONLOADING' | string;
type TargetStatus = 'ACTIVE' | 'INACTIVE' | 'OFFLOADED';

interface TenantEntry {
  name: string;
  activityStatus: ActivityStatus;
  objectCount: number | null;
}

interface InitData {
  connectionId: string;
  collectionName: string;
  readOnly: boolean;
  serverVersion: string;
  offloadModuleAvailable: boolean;
  offloadSupported: boolean;
  offloadMinVersion: string;
  tenants: TenantEntry[];
}

const PREVIEW_LIMIT = 30;

// Virtualized list geometry — only the rows in view are rendered, so the list
// stays smooth with tens of thousands of tenants.
const ROW_HEIGHT = 28;
const LIST_HEIGHT = 340;
const OVERSCAN = 8;

function StatusBadge({ status }: { status: ActivityStatus }) {
  const cls =
    status === 'ACTIVE'
      ? 'mtnt-badge--active'
      : status === 'INACTIVE'
        ? 'mtnt-badge--inactive'
        : status === 'OFFLOADED'
          ? 'mtnt-badge--offloaded'
          : 'mtnt-badge--transition';
  return <span className={`mtnt-badge ${cls}`}>{status}</span>;
}

function ManageTenantsWebview() {
  const [collectionName, setCollectionName] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [serverVersion, setServerVersion] = useState('');
  const [offloadSupported, setOffloadSupported] = useState(false);
  const [offloadModuleAvailable, setOffloadModuleAvailable] = useState(false);
  const [offloadMinVersion, setOffloadMinVersion] = useState('1.26.0');
  const [tenants, setTenants] = useState<TenantEntry[]>([]);

  const [selectionMode, setSelectionMode] = useState<'list' | 'pattern'>('list');
  const [filter, setFilter] = useState('');
  const [countFilter, setCountFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pattern, setPattern] = useState('');
  const [patternMode, setPatternMode] = useState<TenantMatchMode>('wildcard');
  const [targetStatus, setTargetStatus] = useState<TargetStatus>('INACTIVE');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyInit = useCallback((data: InitData) => {
    setCollectionName(data.collectionName);
    setReadOnly(data.readOnly);
    setServerVersion(data.serverVersion);
    setOffloadSupported(data.offloadSupported);
    setOffloadModuleAvailable(data.offloadModuleAvailable);
    setOffloadMinVersion(data.offloadMinVersion);
    setTenants(data.tenants ?? []);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      switch (message?.command) {
        case 'initData':
          applyInit(message as InitData);
          break;
        case 'tenantsUpdated':
          setTenants(message.tenants ?? []);
          setSelected(new Set());
          setIsApplying(false);
          setError(null);
          break;
        case 'error':
          setIsApplying(false);
          setError(message.message ?? 'Unknown error');
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', handler);
    vscode?.postMessage({ command: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, [applyInit]);

  // If offload becomes unsupported but was selected, fall back to a safe status.
  useEffect(() => {
    if (targetStatus === 'OFFLOADED' && !offloadSupported) {
      setTargetStatus('INACTIVE');
    }
  }, [offloadSupported, targetStatus]);

  const tenantNames = useMemo(() => tenants.map((t) => t.name), [tenants]);

  // Compile the count-filter expression once; surface a friendly error on bad input.
  const { countPredicate, countFilterError } = useMemo(() => {
    try {
      return {
        countPredicate: parseCountFilter(countFilter),
        countFilterError: null as string | null,
      };
    } catch (e) {
      return {
        countPredicate: () => true,
        countFilterError: e instanceof Error ? e.message : 'Invalid count filter',
      };
    }
  }, [countFilter]);

  const filteredTenants = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return tenants.filter((t) => {
      // Name matches as a substring; status matches as a prefix so "active" does
      // not also match "INACTIVE" (which contains the substring "active").
      const textMatch =
        !f || t.name.toLowerCase().includes(f) || t.activityStatus.toLowerCase().startsWith(f);
      return textMatch && countPredicate(t.objectCount);
    });
  }, [tenants, filter, countPredicate]);

  // ── Virtualized list windowing ─────────────────────────────────────────────
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Reset the scroll position whenever the filtered set changes so we never
  // stay scrolled past the end of a now-shorter list.
  useEffect(() => {
    setScrollTop(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [filter, countFilter, tenants]);

  const totalRows = filteredTenants.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleRowCount = Math.ceil(LIST_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(totalRows, startIndex + visibleRowCount);
  const visibleTenants = filteredTenants.slice(startIndex, endIndex);
  const topSpacer = startIndex * ROW_HEIGHT;
  const bottomSpacer = Math.max(0, (totalRows - endIndex) * ROW_HEIGHT);

  const selectedFilteredCount = useMemo(
    () => filteredTenants.reduce((n, t) => (selected.has(t.name) ? n + 1 : n), 0),
    [filteredTenants, selected]
  );

  // Pattern-mode matches + validation.
  const { matchedNames, patternError } = useMemo(() => {
    if (selectionMode !== 'pattern' || pattern.trim() === '') {
      return { matchedNames: [] as string[], patternError: null as string | null };
    }
    try {
      return {
        matchedNames: matchTenantNames(tenantNames, pattern, patternMode),
        patternError: null,
      };
    } catch (e) {
      return {
        matchedNames: [] as string[],
        patternError: e instanceof Error ? e.message : 'Invalid pattern',
      };
    }
  }, [selectionMode, pattern, patternMode, tenantNames]);

  const selectedNames = selectionMode === 'list' ? Array.from(selected) : matchedNames;
  const count = selectedNames.length;

  const toggleOne = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredTenants.forEach((t) => next.add(t.name));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredTenants.forEach((t) => next.delete(t.name));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const offloadDisabled = !offloadSupported;
  const applyDisabled =
    readOnly || isApplying || count === 0 || (targetStatus === 'OFFLOADED' && offloadDisabled);

  const handleApply = () => {
    if (readOnly) {
      return;
    }
    setError(null);
    setIsApplying(true);
    vscode?.postMessage({
      command: 'apply',
      status: targetStatus,
      names: selectedNames,
    });
  };

  const handleDelete = () => {
    if (readOnly) {
      return;
    }
    setError(null);
    setIsApplying(true);
    vscode?.postMessage({
      command: 'delete',
      names: selectedNames,
    });
  };

  const deleteDisabled = readOnly || isApplying || count === 0;

  return (
    <div className="mtnt">
      <h1>Manage Tenants</h1>
      <p className="mtnt-sub">
        Collection <code>{collectionName || '…'}</code> · {tenants.length} tenant
        {tenants.length !== 1 ? 's' : ''}
      </p>

      {readOnly && (
        <div className="mtnt-note mtnt-note--warning">
          This connection is <strong>read-only</strong>. Enable write access to change tenant
          states.
        </div>
      )}

      {!offloadSupported && (
        <div className="mtnt-note mtnt-note--warning">
          <strong>Offloading is unavailable.</strong> Setting a tenant to <code>OFFLOADED</code>{' '}
          requires Weaviate <code>&ge; {offloadMinVersion}</code> and the <code>offload-s3</code>{' '}
          module to be enabled and configured on the server.
          <br />
          Detected server version: <code>{serverVersion || 'unknown'}</code>;{' '}
          <code>offload-s3</code> module:{' '}
          <code>{offloadModuleAvailable ? 'available' : 'not available'}</code>.
        </div>
      )}

      {/* ── Selection ─────────────────────────────────────────────── */}
      <div className="mtnt-section">
        <p className="mtnt-section-title">Select tenants</p>
        <div className="mtnt-radio-row">
          <label className="mtnt-radio">
            <input
              type="radio"
              name="selMode"
              checked={selectionMode === 'list'}
              onChange={() => setSelectionMode('list')}
            />
            <span>From list</span>
          </label>
          <label className="mtnt-radio">
            <input
              type="radio"
              name="selMode"
              checked={selectionMode === 'pattern'}
              onChange={() => setSelectionMode('pattern')}
            />
            <span>By pattern</span>
          </label>
        </div>

        {selectionMode === 'list' ? (
          <>
            <div className="mtnt-list-toolbar">
              <input
                className="mtnt-input"
                placeholder="Filter by tenant name or status…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <button
                className="mtnt-link-button"
                onClick={selectAllFiltered}
                title={`Select the ${totalRows} tenant(s) currently shown`}
              >
                Select all{filter ? ' shown' : ''}
              </button>
              {filter && selectedFilteredCount > 0 && (
                <button className="mtnt-link-button" onClick={deselectAllFiltered}>
                  Deselect shown
                </button>
              )}
              <button className="mtnt-link-button" onClick={clearSelection}>
                Clear
              </button>
            </div>
            <div className="mtnt-list-toolbar">
              <input
                className="mtnt-input mtnt-input--mono"
                placeholder="Count filter — e.g. count=0, count>1, 10<count<50"
                value={countFilter}
                onChange={(e) => setCountFilter(e.target.value)}
              />
            </div>
            <div className="mtnt-hint">
              Filter by object count (from node status). Examples: <code>count=0</code>,{' '}
              <code>count&gt;1</code>, <code>count&gt;=10</code>, <code>count&lt;50</code>,{' '}
              <code>10&lt;count&lt;50</code>. Count is only known for <strong>ACTIVE</strong>{' '}
              tenants — others show <code>—</code> and are excluded while a count filter is active.
            </div>
            {countFilterError && <div className="mtnt-error">{countFilterError}</div>}
            <div className="mtnt-list-summary">
              {filter
                ? `${totalRows.toLocaleString()} of ${tenants.length.toLocaleString()} shown`
                : `${tenants.length.toLocaleString()} tenants`}
              {' · '}
              {selected.size.toLocaleString()} selected
            </div>
            <div
              className="mtnt-list"
              ref={listRef}
              style={{ height: LIST_HEIGHT }}
              onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            >
              {totalRows === 0 ? (
                <div className="mtnt-empty">No tenants match the filter.</div>
              ) : (
                <>
                  <div style={{ height: topSpacer }} />
                  {visibleTenants.map((t) => (
                    <label key={t.name} className="mtnt-row" style={{ height: ROW_HEIGHT }}>
                      <input
                        type="checkbox"
                        checked={selected.has(t.name)}
                        onChange={() => toggleOne(t.name)}
                      />
                      <span className="mtnt-row-name">{t.name}</span>
                      <span
                        className="mtnt-row-count"
                        title={
                          t.objectCount === null
                            ? 'Object count unknown (tenant not loaded)'
                            : `${t.objectCount} objects`
                        }
                      >
                        {t.objectCount === null ? '—' : t.objectCount.toLocaleString()}
                      </span>
                      <StatusBadge status={t.activityStatus} />
                    </label>
                  ))}
                  <div style={{ height: bottomSpacer }} />
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="mtnt-list-toolbar">
              <input
                className="mtnt-input mtnt-input--mono"
                placeholder={
                  patternMode === 'wildcard' ? 'e.g. *acme* or tenant-*' : 'e.g. ^tenant-\\d+$'
                }
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
              />
            </div>
            <div className="mtnt-radio-row">
              <label className="mtnt-radio">
                <input
                  type="radio"
                  name="patMode"
                  checked={patternMode === 'wildcard'}
                  onChange={() => setPatternMode('wildcard')}
                />
                <span>Wildcard (* ?)</span>
              </label>
              <label className="mtnt-radio">
                <input
                  type="radio"
                  name="patMode"
                  checked={patternMode === 'regex'}
                  onChange={() => setPatternMode('regex')}
                />
                <span>Regex</span>
              </label>
            </div>
            {patternError ? (
              <div className="mtnt-error">Invalid pattern: {patternError}</div>
            ) : (
              pattern.trim() !== '' && (
                <div className="mtnt-preview">
                  {matchedNames.length} tenant{matchedNames.length !== 1 ? 's' : ''} match
                  {matchedNames.length > 0 && (
                    <div className="mtnt-preview-chips">
                      {matchedNames.slice(0, PREVIEW_LIMIT).map((n) => (
                        <span key={n} className="mtnt-chip">
                          {n}
                        </span>
                      ))}
                      {matchedNames.length > PREVIEW_LIMIT && (
                        <span className="mtnt-chip">
                          +{matchedNames.length - PREVIEW_LIMIT} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* ── Target status ─────────────────────────────────────────── */}
      <div className="mtnt-section">
        <p className="mtnt-section-title">Set status to</p>
        <div className="mtnt-radio-row">
          <label className="mtnt-radio">
            <input
              type="radio"
              name="target"
              checked={targetStatus === 'ACTIVE'}
              onChange={() => setTargetStatus('ACTIVE')}
            />
            <span>Active (load into memory)</span>
          </label>
          <label className="mtnt-radio">
            <input
              type="radio"
              name="target"
              checked={targetStatus === 'INACTIVE'}
              onChange={() => setTargetStatus('INACTIVE')}
            />
            <span>Inactive (offload to disk)</span>
          </label>
          <label className="mtnt-radio" title={offloadDisabled ? 'Offloading is unavailable' : ''}>
            <input
              type="radio"
              name="target"
              disabled={offloadDisabled}
              checked={targetStatus === 'OFFLOADED'}
              onChange={() => setTargetStatus('OFFLOADED')}
            />
            <span>Offloaded (offload-s3)</span>
          </label>
        </div>
      </div>

      {error && <div className="mtnt-error">{error}</div>}

      <div className="mtnt-apply-bar">
        <button className="mtnt-button" onClick={handleApply} disabled={applyDisabled}>
          {isApplying
            ? 'Applying…'
            : `Set ${count} tenant${count !== 1 ? 's' : ''} to ${targetStatus}`}
        </button>
        <button
          className="mtnt-button mtnt-button--danger"
          onClick={handleDelete}
          disabled={deleteDisabled}
          title={readOnly ? 'Read-only connection' : 'Permanently delete the selected tenants'}
        >
          {`Delete ${count} tenant${count !== 1 ? 's' : ''}`}
        </button>
        <span className="mtnt-selection-count">{count} selected</span>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<ManageTenantsWebview />);
}
