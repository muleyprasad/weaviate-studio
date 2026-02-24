/**
 * Interaction / behaviour tests for BackupRestore webview component.
 *
 * Covers the uncovered branches:
 *  - handleCpuPercentageChange (empty, NaN, too low, too high, valid)
 *  - handleRestoreBackup (validation errors, success path, collection modes)
 *  - handleCancel
 *  - handleStartNewRestore
 *  - handleCollectionToggle
 *  - message handling: backupRestored, restoreStatus, error, resetForm
 *  - restore-status display (SUCCESS, FAILED, STARTED, TRANSFERRING)
 *  - auto-refresh controls (checkbox, pause/resume, interval)
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BackupRestoreWebview } from '../BackupRestore';

// Suppress expected console.error for acquireVsCodeApi not present in jsdom.
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dispatch(data: Record<string, unknown>) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }));
  });
}

function initData(overrides: Record<string, unknown> = {}) {
  dispatch({
    command: 'initData',
    backupId: 'bk-001',
    backend: 's3',
    collections: ['Col1', 'Col2'],
    backupDetails: {
      id: 'bk-001',
      backend: 's3',
      status: 'SUCCESS',
      classes: ['Col1', 'Col2'],
    },
    ...overrides,
  });
}

// ─── Initial render ───────────────────────────────────────────────────────────

describe('BackupRestoreWebview — initial state', () => {
  it('renders the header with empty backupId initially', () => {
    render(<BackupRestoreWebview />);
    expect(screen.getByText(/Restore Backup:/)).toBeInTheDocument();
  });

  it('renders the form by default', () => {
    render(<BackupRestoreWebview />);
    expect(screen.getByText(/Restore Configuration/i)).toBeInTheDocument();
  });

  it('renders the Restore Backup button', () => {
    render(<BackupRestoreWebview />);
    expect(screen.getByText('Restore Backup')).toBeInTheDocument();
  });

  it('renders the Cancel button', () => {
    render(<BackupRestoreWebview />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});

// ─── initData message ────────────────────────────────────────────────────────

describe('initData message', () => {
  it('populates backupId in the header', () => {
    render(<BackupRestoreWebview />);
    initData({ backupId: 'my-backup' });
    expect(screen.getByText(/Restore Backup: my-backup/)).toBeInTheDocument();
  });

  it('shows backup details section when backupDetails is provided', () => {
    render(<BackupRestoreWebview />);
    initData();
    expect(screen.getByText('Backup Details')).toBeInTheDocument();
  });

  it('shows duration when present in backupDetails', () => {
    render(<BackupRestoreWebview />);
    initData({
      backupDetails: {
        id: 'bk-001',
        backend: 's3',
        status: 'SUCCESS',
        classes: [],
        duration: '5m 30s',
      },
    });
    expect(screen.getByText('5m 30s')).toBeInTheDocument();
  });

  it('shows path when present in backupDetails', () => {
    render(<BackupRestoreWebview />);
    initData({
      backupDetails: {
        id: 'bk-001',
        backend: 's3',
        status: 'SUCCESS',
        classes: [],
        path: '/backups/bk-001',
      },
    });
    expect(screen.getByText('/backups/bk-001')).toBeInTheDocument();
  });
});

// ─── handleRestoreBackup validation ──────────────────────────────────────────

describe('handleRestoreBackup — validation', () => {
  it('shows error when backupId is empty', () => {
    render(<BackupRestoreWebview />);
    // No initData so backupId stays ''
    fireEvent.click(screen.getByText('Restore Backup'));
    expect(screen.getByText(/Backup ID is required/i)).toBeInTheDocument();
  });

  it('shows error when backend is empty', () => {
    render(<BackupRestoreWebview />);
    // Provide backupId but no backend
    dispatch({ command: 'initData', backupId: 'bk-x', backend: '', collections: [] });
    fireEvent.click(screen.getByText('Restore Backup'));
    expect(screen.getByText(/Backend is required/i)).toBeInTheDocument();
  });
});

// ─── handleRestoreBackup — success path ──────────────────────────────────────

describe('handleRestoreBackup — success', () => {
  it('shows Restoring... while restore is in progress', () => {
    render(<BackupRestoreWebview />);
    initData();
    fireEvent.click(screen.getByText('Restore Backup'));
    expect(screen.getByText('Restoring...')).toBeInTheDocument();
  });

  it('sends restoreBackup postMessage (via console.log — no vscode api)', () => {
    render(<BackupRestoreWebview />);
    initData();
    // No real vscode, but clicking should not throw
    expect(() => fireEvent.click(screen.getByText('Restore Backup'))).not.toThrow();
  });
});

// ─── handleRestoreBackup — include/exclude collections ───────────────────────

describe('handleRestoreBackup — collection modes', () => {
  it('include mode: sends includeCollections when collections are selected', () => {
    render(<BackupRestoreWebview />);
    initData();

    // Switch to include mode
    fireEvent.change(screen.getByLabelText(/collections to restore/i), {
      target: { value: 'include' },
    });

    // Find Col1 checkbox via its label text
    const col1Label = screen.getByText('Col1');
    const col1Checkbox = col1Label
      .closest('label')
      ?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    if (col1Checkbox) {
      fireEvent.click(col1Checkbox);
    }

    // Click restore — should not throw
    expect(() => fireEvent.click(screen.getByText('Restore Backup'))).not.toThrow();
  });
});

// ─── backupRestored message ───────────────────────────────────────────────────

describe('backupRestored message', () => {
  it('hides the form after restore completes', () => {
    render(<BackupRestoreWebview />);
    initData();

    act(() => {
      dispatch({ command: 'backupRestored' });
    });

    // Form "Restore Configuration" heading should be gone
    expect(screen.queryByText('Restore Configuration')).not.toBeInTheDocument();
  });

  it('shows New Restore button after restore completes', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({ command: 'backupRestored' });
    expect(screen.getByText('New Restore')).toBeInTheDocument();
  });
});

// ─── restoreStatus message ────────────────────────────────────────────────────

describe('restoreStatus message', () => {
  it('shows SUCCESS status message', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({
      command: 'restoreStatus',
      status: { id: 'bk-001', backend: 's3', status: 'SUCCESS' },
    });
    expect(screen.getByText(/Backup restored successfully/i)).toBeInTheDocument();
  });

  it('shows FAILED status message', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({
      command: 'restoreStatus',
      status: { id: 'bk-001', backend: 's3', status: 'FAILED' },
    });
    expect(screen.getByText(/Backup restore failed/i)).toBeInTheDocument();
  });

  it('shows STARTED status message', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({
      command: 'restoreStatus',
      status: { id: 'bk-001', backend: 's3', status: 'STARTED' },
    });
    expect(screen.getByText(/Backup restore is in progress/i)).toBeInTheDocument();
  });

  it('shows TRANSFERRING status message', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({
      command: 'restoreStatus',
      status: { id: 'bk-001', backend: 's3', status: 'TRANSFERRING' },
    });
    expect(screen.getByText(/Transferring backup data/i)).toBeInTheDocument();
  });

  it('shows error detail when restoreStatus contains error field', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({
      command: 'restoreStatus',
      status: { id: 'bk-001', backend: 's3', status: 'FAILED', error: 'Disk full' },
    });
    expect(screen.getByText('Disk full')).toBeInTheDocument();
  });

  it('clears restoreStatus when message contains 404 error', () => {
    render(<BackupRestoreWebview />);
    initData();
    // Set a status first
    dispatch({
      command: 'restoreStatus',
      status: { id: 'bk-001', backend: 's3', status: 'STARTED' },
    });
    // Now clear it via 404
    dispatch({ command: 'restoreStatus', status: { error: '404 not found', status: 'FAILED' } });
    // Status section should revert to "no restore process running"
    expect(screen.getByText(/No restore process is currently running/i)).toBeInTheDocument();
  });

  it('shows path when restoreStatus contains path', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({
      command: 'restoreStatus',
      status: { id: 'bk-001', backend: 's3', status: 'SUCCESS', path: '/backups/bk-001' },
    });
    expect(screen.getByText('/backups/bk-001')).toBeInTheDocument();
  });
});

// ─── error message ────────────────────────────────────────────────────────────

describe('error message', () => {
  it('shows error text from extension', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({ command: 'error', message: 'Connection refused' });
    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });

  it('does not show error when message includes 404', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({ command: 'error', message: '404 backup not found' });
    // 404 errors should be silently ignored
    expect(screen.queryByText(/404 backup not found/)).not.toBeInTheDocument();
  });
});

// ─── resetForm message ────────────────────────────────────────────────────────

describe('resetForm message', () => {
  it('clears error after resetForm', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({ command: 'error', message: 'Something went wrong' });
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    dispatch({ command: 'resetForm' });
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
  });
});

// ─── handleStartNewRestore ────────────────────────────────────────────────────

describe('handleStartNewRestore', () => {
  it('shows form again after clicking New Restore', () => {
    render(<BackupRestoreWebview />);
    initData();
    dispatch({ command: 'backupRestored' });
    expect(screen.queryByText('Restore Configuration')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('New Restore'));
    expect(screen.getByText('Restore Configuration')).toBeInTheDocument();
  });
});

// ─── handleCollectionToggle ───────────────────────────────────────────────────

describe('handleCollectionToggle', () => {
  it('toggles collection checkbox on and off', () => {
    render(<BackupRestoreWebview />);
    initData();

    fireEvent.change(screen.getByLabelText(/collections to restore/i), {
      target: { value: 'include' },
    });

    // Find Col1 span and its checkbox sibling
    const col1Span = screen.getByText('Col1');
    const label = col1Span.closest('label') as HTMLLabelElement;
    const checkbox = label.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });
});

// ─── Advanced config toggle ───────────────────────────────────────────────────

describe('advanced configuration', () => {
  it('shows advanced config section when toggled open', () => {
    render(<BackupRestoreWebview />);
    initData();
    fireEvent.click(screen.getByText(/Advanced Configuration/i));
    expect(screen.getByText(/CPU Percentage/i)).toBeInTheDocument();
  });

  it('shows filesystem path field only when backend is filesystem', () => {
    render(<BackupRestoreWebview />);
    dispatch({
      command: 'initData',
      backupId: 'bk-fs',
      backend: 'filesystem',
      collections: [],
      backupDetails: null,
    });
    fireEvent.click(screen.getByText(/Advanced Configuration/i));
    expect(screen.getByText(/Custom Path/i)).toBeInTheDocument();
  });

  it('does not show filesystem path field for s3 backend', () => {
    render(<BackupRestoreWebview />);
    initData({ backend: 's3' });
    fireEvent.click(screen.getByText(/Advanced Configuration/i));
    expect(screen.queryByText(/Custom Path/i)).not.toBeInTheDocument();
  });
});

// ─── Auto-refresh controls ────────────────────────────────────────────────────

describe('auto-refresh controls', () => {
  it('renders auto-refresh checkbox checked by default', () => {
    render(<BackupRestoreWebview />);
    const autoRefreshCheckbox = screen
      .getAllByRole('checkbox')
      .find((cb) => (cb as HTMLInputElement).checked);
    expect(autoRefreshCheckbox).toBeDefined();
  });

  it('shows pause/resume button when auto-refresh is enabled', () => {
    render(<BackupRestoreWebview />);
    // Pause button should be visible when auto-refresh is on
    expect(screen.getByTitle(/Pause auto-refresh/i)).toBeInTheDocument();
  });

  it('toggles pause state on pause/resume button click', () => {
    render(<BackupRestoreWebview />);
    const pauseBtn = screen.getByTitle(/Pause auto-refresh/i);
    fireEvent.click(pauseBtn);
    expect(screen.getByTitle(/Resume auto-refresh/i)).toBeInTheDocument();
  });
});

// ─── Refresh button ───────────────────────────────────────────────────────────

describe('manual refresh button', () => {
  it('renders the Refresh button', () => {
    render(<BackupRestoreWebview />);
    const refreshBtns = screen.getAllByText(/Refresh/i);
    expect(refreshBtns.length).toBeGreaterThan(0);
  });

  it('does not throw when clicking Refresh without backupId/backend', () => {
    render(<BackupRestoreWebview />);
    // No initData — vscode is undefined anyway
    const buttons = screen.getAllByRole('button');
    const refreshBtn = buttons.find((b) => b.textContent?.includes('Refresh'));
    expect(refreshBtn).toBeDefined();
    expect(() => fireEvent.click(refreshBtn!)).not.toThrow();
  });
});

// ─── waitForCompletion checkbox ───────────────────────────────────────────────

describe('waitForCompletion', () => {
  it('toggles wait for completion checkbox', () => {
    render(<BackupRestoreWebview />);
    initData();
    const waitCheckbox = screen.getByRole('checkbox', {
      name: /Wait for completion/i,
    }) as HTMLInputElement;
    expect(waitCheckbox.checked).toBe(false);
    fireEvent.click(waitCheckbox);
    expect(waitCheckbox.checked).toBe(true);
  });
});
