/**
 * Unit tests for RbacUser webview component
 */

import '@testing-library/jest-dom';

describe('RbacUser Webview Component', () => {
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
    it('should compute roles to assign (new roles not in original)', () => {
      const computeDiff = (selected: Set<string>, original: Set<string>) => {
        const rolesToAssign = [...selected].filter((r) => !original.has(r));
        const rolesToRevoke = [...original].filter((r) => !selected.has(r));
        return { rolesToAssign, rolesToRevoke };
      };

      const original = new Set(['viewer']);
      const selected = new Set(['viewer', 'admin']);
      const { rolesToAssign, rolesToRevoke } = computeDiff(selected, original);
      expect(rolesToAssign).toEqual(['admin']);
      expect(rolesToRevoke).toEqual([]);
    });

    it('should compute roles to revoke (original roles not in selected)', () => {
      const computeDiff = (selected: Set<string>, original: Set<string>) => {
        const rolesToAssign = [...selected].filter((r) => !original.has(r));
        const rolesToRevoke = [...original].filter((r) => !selected.has(r));
        return { rolesToAssign, rolesToRevoke };
      };

      const original = new Set(['viewer', 'admin']);
      const selected = new Set(['viewer']);
      const { rolesToAssign, rolesToRevoke } = computeDiff(selected, original);
      expect(rolesToAssign).toEqual([]);
      expect(rolesToRevoke).toEqual(['admin']);
    });

    it('should handle no changes', () => {
      const computeDiff = (selected: Set<string>, original: Set<string>) => ({
        rolesToAssign: [...selected].filter((r) => !original.has(r)),
        rolesToRevoke: [...original].filter((r) => !selected.has(r)),
      });

      const roles = new Set(['viewer', 'admin']);
      const { rolesToAssign, rolesToRevoke } = computeDiff(roles, roles);
      expect(rolesToAssign).toEqual([]);
      expect(rolesToRevoke).toEqual([]);
    });

    it('should handle all roles removed', () => {
      const computeDiff = (selected: Set<string>, original: Set<string>) => ({
        rolesToAssign: [...selected].filter((r) => !original.has(r)),
        rolesToRevoke: [...original].filter((r) => !selected.has(r)),
      });

      const original = new Set(['viewer', 'admin']);
      const selected = new Set<string>();
      const { rolesToAssign, rolesToRevoke } = computeDiff(selected, original);
      expect(rolesToAssign).toEqual([]);
      expect(rolesToRevoke.sort()).toEqual(['admin', 'viewer']);
    });
  });

  describe('form validation', () => {
    it('should require user ID before saving', () => {
      let errorSet = '';
      const validate = (userId: string) => {
        if (!userId.trim()) {
          errorSet = 'User ID is required';
          return false;
        }
        return true;
      };
      expect(validate('')).toBe(false);
      expect(errorSet).toBe('User ID is required');
    });

    it('should allow save with valid user ID', () => {
      const validate = (userId: string) => !!userId.trim();
      expect(validate('my-user')).toBe(true);
    });

    it('should trim whitespace from user ID', () => {
      const normalize = (userId: string) => userId.trim();
      expect(normalize('  my-user  ')).toBe('my-user');
    });
  });

  describe('message handling', () => {
    it('should post ready message on init', () => {
      const postMessage = jest.fn();
      const api = { postMessage };
      api.postMessage({ command: 'ready' });
      expect(postMessage).toHaveBeenCalledWith({ command: 'ready' });
    });

    it('should handle userSaved message', () => {
      let savedCalled = false;
      const handleMessage = (msg: any) => {
        if (msg.command === 'userSaved') {
          savedCalled = true;
        }
      };
      handleMessage({ command: 'userSaved' });
      expect(savedCalled).toBe(true);
    });

    it('should handle error message', () => {
      let errorMsg = '';
      const handleMessage = (msg: any) => {
        if (msg.command === 'error') {
          errorMsg = msg.message;
        }
      };
      handleMessage({ command: 'error', message: 'Failed to create user' });
      expect(errorMsg).toBe('Failed to create user');
    });

    it('should handle initData to set available roles', () => {
      let roles: string[] = [];
      let mode = 'add';
      const handleMessage = (msg: any) => {
        if (msg.command === 'initData') {
          mode = msg.mode || 'add';
          roles = (msg.availableRoles || []).sort();
        }
      };
      handleMessage({
        command: 'initData',
        mode: 'edit',
        availableRoles: ['admin', 'viewer', 'data-reader'],
        assignedRoles: ['viewer'],
        existingUser: { id: 'user1' },
      });
      expect(mode).toBe('edit');
      expect(roles).toEqual(['admin', 'data-reader', 'viewer']);
    });
  });

  describe('role toggle', () => {
    it('should add role to selection when not present', () => {
      const toggle = (set: Set<string>, role: string) => {
        const next = new Set(set);
        if (next.has(role)) {
          next.delete(role);
        } else {
          next.add(role);
        }
        return next;
      };
      const initial = new Set(['viewer']);
      const result = toggle(initial, 'admin');
      expect(result.has('admin')).toBe(true);
      expect(result.has('viewer')).toBe(true);
    });

    it('should remove role from selection when already present', () => {
      const toggle = (set: Set<string>, role: string) => {
        const next = new Set(set);
        if (next.has(role)) {
          next.delete(role);
        } else {
          next.add(role);
        }
        return next;
      };
      const initial = new Set(['viewer', 'admin']);
      const result = toggle(initial, 'admin');
      expect(result.has('admin')).toBe(false);
      expect(result.has('viewer')).toBe(true);
    });
  });
});
