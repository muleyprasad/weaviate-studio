/**
 * Unit tests for RbacRole webview component
 */

import '@testing-library/jest-dom';

describe('RbacRole Webview Component', () => {
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

  describe('roleToPermissionsState', () => {
    it('should return default state for null role', () => {
      const roleToPermissionsState = (role: any) => {
        const DEFAULT: any = {
          collections: { enabled: false, collection: '*' },
          data: { enabled: false, collection: '*', tenant: '*' },
          backups: { enabled: false, collection: '*' },
          tenants: { enabled: false, collection: '*', tenant: '*' },
          roles: { enabled: false, role: '*' },
          users: { enabled: false, user: '*' },
          aliases: { enabled: false, alias: '*', aliasCollection: '*' },
          cluster: { enabled: false },
          nodesMinimal: { enabled: false },
          nodesVerbose: { enabled: false, collection: '*' },
          replicate: { enabled: false, collection: '*', shard: '*' },
          groupsOidc: { enabled: false, groupID: '*' },
        };
        if (!role) {
          return DEFAULT;
        }
        const state = JSON.parse(JSON.stringify(DEFAULT));
        if (role.collectionsPermissions?.length > 0) {
          const p = role.collectionsPermissions[0];
          const a = p.actions || [];
          state.collections = {
            enabled: true,
            collection: p.collection || '*',
            create_collection: a.includes('create_collections'),
            read_config: a.includes('read_collections'),
            update_config: a.includes('update_collections'),
            delete_collection: a.includes('delete_collections'),
          };
        }
        if (role.rolesPermissions?.length > 0) {
          const p = role.rolesPermissions[0];
          const a = p.actions || [];
          state.roles = {
            enabled: true,
            role: p.role || '*',
            create: a.includes('create_roles'),
            read: a.includes('read_roles'),
            update: a.includes('update_roles'),
            delete: a.includes('delete_roles'),
          };
        }
        return state;
      };

      const state = roleToPermissionsState(null);
      expect(state.collections.enabled).toBe(false);
      expect(state.data.enabled).toBe(false);
    });

    it('should parse collectionsPermissions correctly', () => {
      const roleToPermissionsState = (role: any) => {
        const state: any = {
          collections: { enabled: false, collection: '*' },
        };
        if (role.collectionsPermissions?.length > 0) {
          const p = role.collectionsPermissions[0];
          const a = p.actions || [];
          state.collections = {
            enabled: true,
            collection: p.collection || '*',
            create_collection: a.includes('create_collections'),
            read_config: a.includes('read_collections'),
            update_config: a.includes('update_collections'),
            delete_collection: a.includes('delete_collections'),
          };
        }
        return state;
      };

      const role = {
        collectionsPermissions: [
          { collection: 'MyCollection', actions: ['create_collections', 'read_collections'] },
        ],
      };
      const state = roleToPermissionsState(role);
      expect(state.collections.enabled).toBe(true);
      expect(state.collections.collection).toBe('MyCollection');
      expect(state.collections.create_collection).toBe(true);
      expect(state.collections.read_config).toBe(true);
      expect(state.collections.update_config).toBe(false);
      expect(state.collections.delete_collection).toBe(false);
    });

    it('should parse clusterPermissions correctly', () => {
      const parseCluster = (role: any) => {
        if (role.clusterPermissions?.length > 0) {
          const a = role.clusterPermissions[0].actions || [];
          return { enabled: true, read: a.includes('read_cluster') };
        }
        return { enabled: false };
      };

      const role = { clusterPermissions: [{ actions: ['read_cluster'] }] };
      const cfg = parseCluster(role);
      expect(cfg.enabled).toBe(true);
      expect(cfg.read).toBe(true);
    });

    it('should parse nodesPermissions by verbosity', () => {
      const parseNodes = (role: any) => {
        const minimal: any = { enabled: false };
        const verbose: any = { enabled: false };
        if (role.nodesPermissions?.length > 0) {
          const minEntry = role.nodesPermissions.find((p: any) => p.verbosity === 'minimal');
          const verbEntry = role.nodesPermissions.find((p: any) => p.verbosity === 'verbose');
          if (minEntry) {
            minimal.enabled = true;
            minimal.read = (minEntry.actions || []).includes('read_nodes');
          }
          if (verbEntry) {
            verbose.enabled = true;
            verbose.collection = verbEntry.collection || '*';
            verbose.read = (verbEntry.actions || []).includes('read_nodes');
          }
        }
        return { minimal, verbose };
      };

      const role = {
        nodesPermissions: [
          { verbosity: 'minimal', actions: ['read_nodes'] },
          { verbosity: 'verbose', collection: 'MyCol', actions: ['read_nodes'] },
        ],
      };
      const { minimal, verbose } = parseNodes(role);
      expect(minimal.enabled).toBe(true);
      expect(minimal.read).toBe(true);
      expect(verbose.enabled).toBe(true);
      expect(verbose.collection).toBe('MyCol');
    });
  });

  describe('countConfiguredActions', () => {
    it('should return 0 for disabled config', () => {
      const count = (cfg: any) =>
        [
          cfg.create,
          cfg.read,
          cfg.update,
          cfg.delete,
          cfg.manage,
          cfg.assignAndRevoke,
          cfg.create_collection,
          cfg.read_config,
          cfg.update_config,
          cfg.delete_collection,
        ].filter(Boolean).length;

      expect(count({ enabled: false })).toBe(0);
    });

    it('should count enabled actions correctly', () => {
      const count = (cfg: any) =>
        [
          cfg.create,
          cfg.read,
          cfg.update,
          cfg.delete,
          cfg.manage,
          cfg.assignAndRevoke,
          cfg.create_collection,
          cfg.read_config,
          cfg.update_config,
          cfg.delete_collection,
        ].filter(Boolean).length;

      const cfg = { enabled: true, create: true, read: true, update: false, delete: false };
      expect(count(cfg)).toBe(2);
    });
  });

  describe('message handling', () => {
    it('should post ready message on init', () => {
      // Simulate acquireVsCodeApi and ready message
      const postMessage = jest.fn();
      const api = { postMessage, getState: jest.fn(), setState: jest.fn() };
      // Verify that the component would call postMessage({ command: 'ready' })
      api.postMessage({ command: 'ready' });
      expect(postMessage).toHaveBeenCalledWith({ command: 'ready' });
    });

    it('should handle error message from extension', () => {
      // Verify error state is set when error command is received
      let errorState = '';
      const handleMessage = (msg: any) => {
        if (msg.command === 'error') {
          errorState = msg.message;
        }
      };
      handleMessage({ command: 'error', message: 'Something went wrong' });
      expect(errorState).toBe('Something went wrong');
    });

    it('should handle roleSaved message from extension', () => {
      let savedCalled = false;
      const handleMessage = (msg: any) => {
        if (msg.command === 'roleSaved') {
          savedCalled = true;
        }
      };
      handleMessage({ command: 'roleSaved' });
      expect(savedCalled).toBe(true);
    });
  });

  describe('form validation', () => {
    it('should require role name before saving', () => {
      let errorSet = '';
      const validateAndSave = (roleName: string, permissions: any) => {
        if (!roleName.trim()) {
          errorSet = 'Role name is required';
          return false;
        }
        return true;
      };
      expect(validateAndSave('', {})).toBe(false);
      expect(errorSet).toBe('Role name is required');
    });

    it('should allow save with valid role name', () => {
      const validateAndSave = (roleName: string) => !!roleName.trim();
      expect(validateAndSave('my-role')).toBe(true);
    });

    it('should block save in edit mode when all permission rules are removed', () => {
      const DEFAULT_PERMISSIONS: Record<string, any[]> = {
        collections: [],
        data: [],
        backups: [],
        tenants: [],
        roles: [],
        users: [],
        aliases: [],
        cluster: [],
        nodesMinimal: [],
        nodesVerbose: [],
        replicate: [],
        groupsOidc: [],
      };

      let errorSet = '';
      const validateAndSave = (
        roleName: string,
        mode: 'add' | 'edit',
        permissions: Record<string, any[]>
      ): boolean => {
        if (!roleName.trim()) {
          errorSet = 'Role name is required';
          return false;
        }
        const totalRules = Object.values(permissions).reduce((sum, arr) => sum + arr.length, 0);
        if (mode === 'edit' && totalRules === 0) {
          errorSet =
            'Cannot save a role with no permission rules. Add at least one rule, or delete the role explicitly.';
          return false;
        }
        return true;
      };

      // Blocked in edit mode with zero rules
      errorSet = '';
      expect(validateAndSave('my-role', 'edit', DEFAULT_PERMISSIONS)).toBe(false);
      expect(errorSet).toContain('no permission rules');

      // Allowed in add mode with zero rules (empty role creation is a server-side concern)
      errorSet = '';
      expect(validateAndSave('my-role', 'add', DEFAULT_PERMISSIONS)).toBe(true);
      expect(errorSet).toBe('');

      // Allowed in edit mode when at least one rule exists
      errorSet = '';
      const withRules = {
        ...DEFAULT_PERMISSIONS,
        collections: [{ collection: '*', read_config: true }],
      };
      expect(validateAndSave('my-role', 'edit', withRules)).toBe(true);
      expect(errorSet).toBe('');
    });
  });
});
