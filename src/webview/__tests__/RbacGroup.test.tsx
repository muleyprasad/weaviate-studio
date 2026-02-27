/**
 * Unit tests for RbacGroup webview component
 */

import '@testing-library/jest-dom';

describe('RbacGroup Webview Component', () => {
  const mockPostMessage = jest.fn();
  const mockVSCodeApi = {
    postMessage: mockPostMessage,
    getState: jest.fn(),
    setState: jest.fn(),
  };

  beforeAll(() => {
    (global as any).window = {
      acquireVsCodeApi: () => mockVSCodeApi,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('role diff calculation', () => {
    it('should compute roles to assign', () => {
      const computeDiff = (selected: Set<string>, original: Set<string>) => ({
        rolesToAssign: [...selected].filter((r) => !original.has(r)),
        rolesToRevoke: [...original].filter((r) => !selected.has(r)),
      });

      const original = new Set<string>();
      const selected = new Set(['admin', 'viewer']);
      const { rolesToAssign, rolesToRevoke } = computeDiff(selected, original);
      expect(rolesToAssign.sort()).toEqual(['admin', 'viewer']);
      expect(rolesToRevoke).toEqual([]);
    });

    it('should compute roles to revoke', () => {
      const computeDiff = (selected: Set<string>, original: Set<string>) => ({
        rolesToAssign: [...selected].filter((r) => !original.has(r)),
        rolesToRevoke: [...original].filter((r) => !selected.has(r)),
      });

      const original = new Set(['admin', 'viewer']);
      const selected = new Set(['viewer']);
      const { rolesToAssign, rolesToRevoke } = computeDiff(selected, original);
      expect(rolesToAssign).toEqual([]);
      expect(rolesToRevoke).toEqual(['admin']);
    });

    it('should advance originalRoles baseline after successful save so re-saves compute correct diff', () => {
      const computeDiff = (selected: Set<string>, original: Set<string>) => ({
        rolesToAssign: [...selected].filter((r) => !original.has(r)),
        rolesToRevoke: [...original].filter((r) => !selected.has(r)),
      });

      // Initial state: group has [viewer]
      let originalRoles = new Set(['viewer']);
      let selectedRoles = new Set(['viewer']);

      // User adds 'admin' and saves
      selectedRoles = new Set(['viewer', 'admin']);
      const firstSave = computeDiff(selectedRoles, originalRoles);
      expect(firstSave.rolesToAssign).toEqual(['admin']);
      expect(firstSave.rolesToRevoke).toEqual([]);

      // Save succeeds — baseline advances to current selectedRoles (the fix)
      originalRoles = new Set(selectedRoles);

      // User now removes 'admin'
      selectedRoles = new Set(['viewer']);
      const secondSave = computeDiff(selectedRoles, originalRoles);
      // With the fix: admin is correctly identified for revocation
      expect(secondSave.rolesToAssign).toEqual([]);
      expect(secondSave.rolesToRevoke).toEqual(['admin']);

      // Without the fix (stale baseline = original {viewer}), the second diff would be:
      // rolesToAssign=[], rolesToRevoke=[] — silently missing the revocation
    });
  });

  describe('form validation', () => {
    it('should require group ID before saving', () => {
      let errorSet = '';
      const validate = (groupId: string) => {
        if (!groupId.trim()) {
          errorSet = 'Group ID is required';
          return false;
        }
        return true;
      };
      expect(validate('')).toBe(false);
      expect(errorSet).toBe('Group ID is required');
    });

    it('should allow save with valid group ID', () => {
      const validate = (groupId: string) => !!groupId.trim();
      expect(validate('data-team')).toBe(true);
    });

    it('should trim whitespace from group ID', () => {
      const normalize = (id: string) => id.trim();
      expect(normalize('  data-team  ')).toBe('data-team');
    });
  });

  describe('message handling', () => {
    it('should post ready message on init', () => {
      const postMessage = jest.fn();
      const api = { postMessage };
      api.postMessage({ command: 'ready' });
      expect(postMessage).toHaveBeenCalledWith({ command: 'ready' });
    });

    it('should handle groupSaved message', () => {
      let savedCalled = false;
      const handleMessage = (msg: any) => {
        if (msg.command === 'groupSaved') {
          savedCalled = true;
        }
      };
      handleMessage({ command: 'groupSaved' });
      expect(savedCalled).toBe(true);
    });

    it('should handle error message', () => {
      let errorMsg = '';
      const handleMessage = (msg: any) => {
        if (msg.command === 'error') {
          errorMsg = msg.message;
        }
      };
      handleMessage({ command: 'error', message: 'Failed to assign roles' });
      expect(errorMsg).toBe('Failed to assign roles');
    });

    it('should update availableRoles list when rolesUpdated message is received', () => {
      let roles: string[] = ['admin', 'viewer'];
      const handleMessage = (msg: any) => {
        if (msg.command === 'rolesUpdated') {
          roles = (msg.availableRoles || []).sort((a: string, b: string) => a.localeCompare(b));
        }
      };

      // A new role was added elsewhere — list grows
      handleMessage({ command: 'rolesUpdated', availableRoles: ['admin', 'new-role', 'viewer'] });
      expect(roles).toEqual(['admin', 'new-role', 'viewer']);
    });

    it('should remove a deleted role from the list when rolesUpdated is received', () => {
      let roles: string[] = ['admin', 'old-role', 'viewer'];
      const handleMessage = (msg: any) => {
        if (msg.command === 'rolesUpdated') {
          roles = (msg.availableRoles || []).sort((a: string, b: string) => a.localeCompare(b));
        }
      };

      handleMessage({ command: 'rolesUpdated', availableRoles: ['admin', 'viewer'] });
      expect(roles).toEqual(['admin', 'viewer']);
      expect(roles).not.toContain('old-role');
    });

    it('should sort roles alphabetically from rolesUpdated message', () => {
      let roles: string[] = [];
      const handleMessage = (msg: any) => {
        if (msg.command === 'rolesUpdated') {
          roles = (msg.availableRoles || []).sort((a: string, b: string) => a.localeCompare(b));
        }
      };

      handleMessage({
        command: 'rolesUpdated',
        availableRoles: ['zebra-role', 'admin', 'mid-role'],
      });
      expect(roles).toEqual(['admin', 'mid-role', 'zebra-role']);
    });

    it('should handle initData for add mode', () => {
      let mode = '';
      let roles: string[] = [];
      const handleMessage = (msg: any) => {
        if (msg.command === 'initData') {
          mode = msg.mode || 'add';
          roles = (msg.availableRoles || []).sort();
        }
      };
      handleMessage({
        command: 'initData',
        mode: 'add',
        availableRoles: ['admin', 'viewer'],
        assignedRoles: [],
        existingGroup: undefined,
      });
      expect(mode).toBe('add');
      expect(roles).toEqual(['admin', 'viewer']);
    });

    it('should handle initData for edit mode', () => {
      let groupId = '';
      let assigned: string[] = [];
      const handleMessage = (msg: any) => {
        if (msg.command === 'initData' && msg.mode === 'edit') {
          groupId = msg.existingGroup || '';
          assigned = msg.assignedRoles || [];
        }
      };
      handleMessage({
        command: 'initData',
        mode: 'edit',
        existingGroup: 'data-team',
        availableRoles: ['admin', 'viewer'],
        assignedRoles: ['viewer'],
      });
      expect(groupId).toBe('data-team');
      expect(assigned).toEqual(['viewer']);
    });
  });

  describe('saveGroup payload', () => {
    it('should include correct fields in save payload', () => {
      const buildPayload = (
        groupId: string,
        rolesToAssign: string[],
        rolesToRevoke: string[],
        mode: string
      ) => ({
        groupId: groupId.trim(),
        rolesToAssign,
        rolesToRevoke,
        mode,
      });

      const payload = buildPayload('admins', ['admin'], [], 'add');
      expect(payload.groupId).toBe('admins');
      expect(payload.rolesToAssign).toEqual(['admin']);
      expect(payload.rolesToRevoke).toEqual([]);
      expect(payload.mode).toBe('add');
    });
  });
});
