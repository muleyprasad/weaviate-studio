/**
 * Tests for RBAC-related tree data provider features:
 * - _ensureUsersCached (includeLastUsedTime, caching, error propagation)
 * - getUsers public method
 * - rbacGroupItem expansion (roles assigned to a group)
 * - rbacUserDetails expansion (roles under a user, sorted)
 * - lastUsedAt display in user details
 * - Built-in roles sorted at bottom with correct contextValue
 * - weaviateRbacRoleRef contextValue on role links
 */

import { WeaviateTreeDataProvider } from '../WeaviateTreeDataProvider';
import * as vscode from 'vscode';

// ── Configurable mock client ──────────────────────────────────────────────────

let mockGetClient: jest.Mock;

class MockConnectionManager {
  private static instance: MockConnectionManager;

  static getInstance(_ctx: any, _seed?: any): MockConnectionManager {
    if (!MockConnectionManager.instance) {
      MockConnectionManager.instance = new MockConnectionManager();
    }
    return MockConnectionManager.instance;
  }

  getConnections() {
    return [];
  }
  getConnection(_id: string) {
    return null;
  }
  getClient(_id: string) {
    return mockGetClient(_id);
  }
  onConnectionsChanged(_cb: () => void) {}
}

jest.mock('../../services/ConnectionManager', () => ({
  ConnectionManager: {
    getInstance: (...args: any[]) => MockConnectionManager.getInstance(args[0]),
  },
}));

jest.mock('../../views/ViewRenderer', () => ({
  ViewRenderer: {
    getInstance: () => ({ renderDetailedSchema: jest.fn(), renderRawConfig: jest.fn() }),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockCtx = {
  globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
  subscriptions: [],
} as unknown as vscode.ExtensionContext;

function makeItem(itemType: string, connectionId: string, itemId?: string) {
  return { itemType, connectionId, itemId } as any;
}

function makeClient(
  overrides: Partial<{
    listAllUsers: any[];
    listAllUsersError: Error;
    getAssignedRoles: Record<string, any>;
    getAssignedRolesError: Error;
  }> = {}
) {
  return {
    users: {
      db: {
        listAll: overrides.listAllUsersError
          ? jest.fn().mockRejectedValue(overrides.listAllUsersError)
          : jest.fn().mockResolvedValue(overrides.listAllUsers ?? []),
      },
    },
    groups: {
      oidc: {
        getAssignedRoles: overrides.getAssignedRolesError
          ? jest.fn().mockRejectedValue(overrides.getAssignedRolesError)
          : jest.fn().mockResolvedValue(overrides.getAssignedRoles ?? {}),
      },
    },
    roles: {
      listAll: jest.fn().mockResolvedValue({}),
      byName: jest.fn().mockResolvedValue(null),
    },
  };
}

// ── Test setup ────────────────────────────────────────────────────────────────

describe('RBAC Tree Features', () => {
  let provider: WeaviateTreeDataProvider;

  beforeEach(() => {
    jest.resetModules();
    (MockConnectionManager as any).instance = undefined;
    mockGetClient = jest.fn().mockReturnValue(null);
    provider = new (require('../WeaviateTreeDataProvider').WeaviateTreeDataProvider)(mockCtx);
  });

  // ── _ensureUsersCached ─────────────────────────────────────────────────────

  describe('_ensureUsersCached', () => {
    it('calls listAll with includeLastUsedTime: true', async () => {
      const client = makeClient({ listAllUsers: [] });
      await (provider as any)._ensureUsersCached('conn-1', client);
      expect(client.users.db.listAll).toHaveBeenCalledWith({ includeLastUsedTime: true });
    });

    it('caches the result and does not call listAll a second time', async () => {
      const client = makeClient({ listAllUsers: [{ id: 'user-a' }] });
      await (provider as any)._ensureUsersCached('conn-1', client);
      await (provider as any)._ensureUsersCached('conn-1', client);
      expect(client.users.db.listAll).toHaveBeenCalledTimes(1);
    });

    it('normalises array response into the cache', async () => {
      const users = [{ id: 'u1' }, { id: 'u2' }];
      const client = makeClient({ listAllUsers: users });
      await (provider as any)._ensureUsersCached('conn-1', client);
      const cached = (provider as any).rbacCache['conn-1']?.users;
      expect(cached).toEqual(users);
    });

    it('propagates API errors so callers can handle them', async () => {
      const client = makeClient({ listAllUsersError: new Error('network error') });
      await expect((provider as any)._ensureUsersCached('conn-1', client)).rejects.toThrow(
        'network error'
      );
    });
  });

  // ── getUsers ───────────────────────────────────────────────────────────────

  describe('getUsers', () => {
    it('returns [] when no client is found', async () => {
      mockGetClient.mockReturnValue(null);
      const result = await provider.getUsers('conn-1');
      expect(result).toEqual([]);
    });

    it('returns the user list on success', async () => {
      const users = [{ id: 'alice' }, { id: 'bob' }];
      mockGetClient.mockReturnValue(makeClient({ listAllUsers: users }));
      const result = await provider.getUsers('conn-1');
      expect(result).toEqual(users);
    });

    it('returns [] when the API throws', async () => {
      mockGetClient.mockReturnValue(makeClient({ listAllUsersError: new Error('forbidden') }));
      const result = await provider.getUsers('conn-1');
      expect(result).toEqual([]);
    });

    it('does not re-fetch when users are already cached', async () => {
      const client = makeClient({ listAllUsers: [{ id: 'alice' }] });
      mockGetClient.mockReturnValue(client);
      await provider.getUsers('conn-1');
      await provider.getUsers('conn-1');
      expect(client.users.db.listAll).toHaveBeenCalledTimes(1);
    });
  });

  // ── rbacGroupItem expansion ────────────────────────────────────────────────

  describe('rbacGroupItem children (roles assigned to a group)', () => {
    it('returns role items with weaviateRbacRoleRef contextValue', async () => {
      const client = makeClient({
        getAssignedRoles: { admin: {}, 'data-reader': {} },
      });
      mockGetClient.mockReturnValue(client);

      const children = await provider.getChildren(makeItem('rbacGroupItem', 'conn-1', 'my-group'));

      expect(children.length).toBe(2);
      children.forEach((c: any) => {
        expect(c.contextValue).toBe('weaviateRbacRoleRef');
      });
    });

    it('uses the role name as itemId so editRole command works', async () => {
      const client = makeClient({ getAssignedRoles: { editor: {} } });
      mockGetClient.mockReturnValue(client);

      const children = await provider.getChildren(makeItem('rbacGroupItem', 'conn-1', 'my-group'));

      expect(children[0].itemId).toBe('editor');
    });

    it('sorts roles alphabetically', async () => {
      const client = makeClient({
        getAssignedRoles: { viewer: {}, 'admin-custom': {}, 'data-reader': {} },
      });
      mockGetClient.mockReturnValue(client);

      const children = await provider.getChildren(makeItem('rbacGroupItem', 'conn-1', 'my-group'));

      const labels = children.map((c: any) => c.label);
      expect(labels).toEqual(['admin-custom', 'data-reader', 'viewer']);
    });

    it('returns "No roles assigned" leaf when group has no roles', async () => {
      const client = makeClient({ getAssignedRoles: {} });
      mockGetClient.mockReturnValue(client);

      const children = await provider.getChildren(
        makeItem('rbacGroupItem', 'conn-1', 'empty-group')
      );

      expect(children).toHaveLength(1);
      expect(children[0].label).toBe('No roles assigned');
    });

    it('returns error item when getAssignedRoles throws', async () => {
      const client = makeClient({
        getAssignedRolesError: new Error('unauthorized'),
      });
      mockGetClient.mockReturnValue(client);

      const children = await provider.getChildren(makeItem('rbacGroupItem', 'conn-1', 'my-group'));

      expect(children).toHaveLength(1);
      expect(children[0].label).toMatch(/error/i);
    });

    it('returns [] when no client is available', async () => {
      mockGetClient.mockReturnValue(null);

      const children = await provider.getChildren(makeItem('rbacGroupItem', 'conn-1', 'my-group'));

      expect(children).toEqual([]);
    });
  });

  // ── rbacUserDetails expansion (roles under a user) ─────────────────────────

  describe('rbacUserDetails children (roles under a user, sorted)', () => {
    beforeEach(() => {
      // Pre-populate cache so we don't need a real client
      (provider as any).rbacCache['conn-1'] = {
        users: [{ id: 'alice', roleNames: ['viewer', 'admin', 'data-reader'] }],
      };
    });

    it('returns role items sorted alphabetically', async () => {
      const children = await provider.getChildren(makeItem('rbacUserDetails', 'conn-1', 'alice'));

      const labels = children.map((c: any) => c.label);
      expect(labels).toEqual(['admin', 'data-reader', 'viewer']);
    });

    it('each role item has weaviateRbacRoleRef contextValue', async () => {
      const children = await provider.getChildren(makeItem('rbacUserDetails', 'conn-1', 'alice'));

      children.forEach((c: any) => {
        expect(c.contextValue).toBe('weaviateRbacRoleRef');
      });
    });

    it('each role item uses the role name as itemId', async () => {
      const children = await provider.getChildren(makeItem('rbacUserDetails', 'conn-1', 'alice'));

      const itemIds = children.map((c: any) => c.itemId);
      expect(itemIds).toEqual(['admin', 'data-reader', 'viewer']);
    });

    it('returns [] when user is not in cache', async () => {
      const children = await provider.getChildren(
        makeItem('rbacUserDetails', 'conn-1', 'unknown-user')
      );
      expect(children).toEqual([]);
    });
  });

  // ── lastUsedAt in user details ─────────────────────────────────────────────

  describe('rbacUser children — lastUsedAt display', () => {
    it('shows Last used item when lastUsedAt is present', async () => {
      (provider as any).rbacCache['conn-1'] = {
        users: [
          {
            id: 'alice',
            userType: 'db',
            active: true,
            lastUsedAt: '2024-01-15T10:00:00Z',
          },
        ],
      };

      const children = await provider.getChildren(makeItem('rbacUser', 'conn-1', 'alice'));

      const lastUsedItem = children.find(
        (c: any) => typeof c.label === 'string' && c.label.startsWith('Last used:')
      );
      expect(lastUsedItem).toBeDefined();
    });

    it('omits Last used item when lastUsedAt is absent', async () => {
      (provider as any).rbacCache['conn-1'] = {
        users: [{ id: 'bob', userType: 'db', active: true }],
      };

      const children = await provider.getChildren(makeItem('rbacUser', 'conn-1', 'bob'));

      const lastUsedItem = children.find(
        (c: any) => typeof c.label === 'string' && c.label.startsWith('Last used:')
      );
      expect(lastUsedItem).toBeUndefined();
    });
  });

  // ── Built-in roles sorted at bottom ───────────────────────────────────────

  describe('rbacRoles children — built-in roles at bottom', () => {
    const allRoles = [
      { name: 'viewer' },
      { name: 'my-custom-role' },
      { name: 'admin' },
      { name: 'read-only' },
      { name: 'another-custom' },
      { name: 'root' },
    ];
    const BUILTINS = new Set(['admin', 'root', 'read-only', 'viewer']);

    beforeEach(() => {
      // Pre-cache roles so client.roles.listAll() is not called
      (provider as any).rbacCache['conn-1'] = { roles: allRoles };
      // getClient must return non-null or the handler returns [] before reading cache
      mockGetClient.mockReturnValue(makeClient());
    });

    it('returns custom roles before built-in roles', async () => {
      const children = await provider.getChildren(makeItem('rbacRoles', 'conn-1', undefined));

      const labels: string[] = children.map((c: any) => c.label);
      // All custom labels should appear before any builtin label
      const firstBuiltinIdx = labels.findIndex((l) => BUILTINS.has(l));
      const customLabels = labels.filter((l) => !BUILTINS.has(l));
      customLabels.forEach((cl) => {
        expect(labels.indexOf(cl)).toBeLessThan(firstBuiltinIdx);
      });
    });

    it('sorts custom roles alphabetically among themselves', async () => {
      const children = await provider.getChildren(makeItem('rbacRoles', 'conn-1', undefined));

      const labels: string[] = children.map((c: any) => c.label);
      const customLabels = labels.filter((l) => !BUILTINS.has(l));
      expect(customLabels).toEqual([...customLabels].sort());
    });

    it('built-in roles have weaviateRbacRoleBuiltin contextValue', async () => {
      const children = await provider.getChildren(makeItem('rbacRoles', 'conn-1', undefined));

      const adminItem = children.find((c: any) => c.label === 'admin');
      expect(adminItem?.contextValue).toBe('weaviateRbacRoleBuiltin');
    });

    it('custom roles have weaviateRbacRole contextValue', async () => {
      const children = await provider.getChildren(makeItem('rbacRoles', 'conn-1', undefined));

      const customItem = children.find((c: any) => c.label === 'my-custom-role');
      expect(customItem?.contextValue).toBe('weaviateRbacRole');
    });

    it('built-in roles use the lock icon', async () => {
      const children = await provider.getChildren(makeItem('rbacRoles', 'conn-1', undefined));

      const rootItem: any = children.find((c: any) => c.label === 'root');
      expect((rootItem?.iconPath as any)?.id).toBe('lock');
    });
  });

  // ── Roles (N) description on user item is sorted ──────────────────────────

  describe('rbacUser children — Roles container description is sorted', () => {
    it('description on the Roles container lists role names alphabetically', async () => {
      (provider as any).rbacCache['conn-1'] = {
        users: [
          { id: 'alice', userType: 'db', active: true, roleNames: ['viewer', 'admin', 'editor'] },
        ],
      };

      const children = await provider.getChildren(makeItem('rbacUser', 'conn-1', 'alice'));

      const rolesContainer: any = children.find(
        (c: any) => typeof c.label === 'string' && c.label.startsWith('Roles (')
      );
      expect(rolesContainer).toBeDefined();
      expect(rolesContainer.description).toBe('admin, editor, viewer');
    });
  });
});
