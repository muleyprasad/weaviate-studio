/**
 * Render tests for BackupRestore webview component.
 *
 * Specifically verifies the correctness bug fixed in the PR:
 *   collection checkboxes must be sourced from backupDetails.classes
 *   (the collections that are actually in the backup), NOT from the
 *   `collections` state (the current cluster collections).
 *
 * Covers:
 *   - collectionMode 'include'/'exclude' renders from backupDetails.classes
 *   - backupDetails.classes empty/undefined → no checkboxes rendered
 *   - backupDetails null → no crash
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BackupRestoreWebview } from '../BackupRestore';

// Suppress the expected console.error from acquireVsCodeApi not being
// available in the jsdom test environment.
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Simulate the extension sending an initData message to the webview. */
function dispatchInitData(data: {
  backupId?: string;
  backend?: string;
  collections?: string[];
  backupDetails?: Record<string, unknown> | null;
}) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { command: 'initData', ...data } }));
  });
}

/** Switch the "Collections to Restore" select to the given mode. */
function setCollectionMode(mode: 'all' | 'include' | 'exclude') {
  fireEvent.change(screen.getByLabelText(/collections to restore/i), {
    target: { value: mode },
  });
}

describe('BackupRestore rendering — collection checkbox source', () => {
  describe('include and exclude modes render from backupDetails.classes, not collections', () => {
    it('include mode: shows backupDetails.classes as checkboxes, not current collections', () => {
      render(<BackupRestoreWebview />);

      dispatchInitData({
        backupId: 'backup-001',
        backend: 's3',
        collections: ['CurrentA', 'CurrentB', 'CurrentC'],
        backupDetails: {
          id: 'backup-001',
          backend: 's3',
          status: 'SUCCESS',
          classes: ['BackedUpX', 'BackedUpY'],
        },
      });

      setCollectionMode('include');

      // Backed-up classes must appear as checkbox labels
      expect(screen.getAllByText('BackedUpX')).not.toHaveLength(0);
      expect(screen.getAllByText('BackedUpY')).not.toHaveLength(0);

      // Current cluster collections must NOT appear
      expect(screen.queryAllByText('CurrentA')).toHaveLength(0);
      expect(screen.queryAllByText('CurrentB')).toHaveLength(0);
      expect(screen.queryAllByText('CurrentC')).toHaveLength(0);
    });

    it('exclude mode: shows backupDetails.classes as checkboxes, not current collections', () => {
      render(<BackupRestoreWebview />);

      dispatchInitData({
        backupId: 'backup-002',
        backend: 'gcs',
        collections: ['CurrentA', 'CurrentB'],
        backupDetails: {
          id: 'backup-002',
          backend: 'gcs',
          status: 'SUCCESS',
          classes: ['BackedUpX'],
        },
      });

      setCollectionMode('exclude');

      expect(screen.getAllByText('BackedUpX')).not.toHaveLength(0);
      expect(screen.queryAllByText('CurrentA')).toHaveLength(0);
      expect(screen.queryAllByText('CurrentB')).toHaveLength(0);
    });
  });

  describe('backupDetails.classes empty or undefined renders no collection checkboxes', () => {
    it('renders no checkboxes when backupDetails.classes is an empty array', () => {
      render(<BackupRestoreWebview />);

      dispatchInitData({
        backupId: 'backup-003',
        backend: 's3',
        collections: ['CurrentA'],
        backupDetails: { id: 'backup-003', backend: 's3', status: 'SUCCESS', classes: [] },
      });

      setCollectionMode('include');

      // The "Select Collections to Include:" heading should not appear
      expect(screen.queryByText(/select collections to include/i)).not.toBeInTheDocument();
    });

    it('renders no checkboxes when backupDetails.classes is undefined', () => {
      render(<BackupRestoreWebview />);

      dispatchInitData({
        backupId: 'backup-004',
        backend: 's3',
        collections: ['CurrentA'],
        // backupDetails has no classes field
        backupDetails: { id: 'backup-004', backend: 's3', status: 'SUCCESS' },
      });

      setCollectionMode('include');

      expect(screen.queryByText(/select collections to include/i)).not.toBeInTheDocument();
    });
  });

  describe('null safety: backupDetails null does not crash the component', () => {
    it('does not crash in include mode when backupDetails is null', () => {
      render(<BackupRestoreWebview />);

      dispatchInitData({
        backupId: 'backup-005',
        backend: 's3',
        collections: ['CurrentA'],
        backupDetails: null,
      });

      setCollectionMode('include');

      // Component must still render its header
      expect(screen.getByText(/Restore Backup:/)).toBeInTheDocument();
      // No collection checkboxes section
      expect(screen.queryByText(/select collections to include/i)).not.toBeInTheDocument();
    });

    it('does not crash in exclude mode when backupDetails is null', () => {
      render(<BackupRestoreWebview />);

      dispatchInitData({
        backupId: 'backup-006',
        backend: 's3',
        backupDetails: null,
      });

      setCollectionMode('exclude');

      expect(screen.getByText(/Restore Backup:/)).toBeInTheDocument();
      expect(screen.queryByText(/select collections to exclude/i)).not.toBeInTheDocument();
    });
  });
});
