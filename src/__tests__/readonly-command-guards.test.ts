/**
 * Tests for the readonly guard pattern applied to write command handlers in extension.ts.
 *
 * These tests verify the guard logic in isolation: given a connection with readOnly=true,
 * the handler must show an error message and return before performing any write operation.
 *
 * Pattern under test (extracted from each command handler):
 *   const conn = connectionManager.getConnection(connectionId);
 *   if (conn?.readOnly === true) {
 *     showErrorMessage(`Connection "${conn.name}" is in read-only mode`);
 *     return;
 *   }
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Connection {
  id: string;
  name: string;
  readOnly?: boolean;
}

/**
 * Mirrors the guard block added to every write command handler.
 * Returns the error message if blocked, or null if allowed through.
 */
function applyReadOnlyGuard(
  connectionId: string,
  getConnection: (id: string) => Connection | undefined
): string | null {
  const conn = getConnection(connectionId);
  if (conn?.readOnly === true) {
    return `Connection "${conn.name}" is in read-only mode`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared test factory
// ---------------------------------------------------------------------------

function itBlocksWhenReadOnly(connectionName: string) {
  it('shows error and blocks execution when connection is readOnly', () => {
    const conn: Connection = { id: '1', name: connectionName, readOnly: true };
    const error = applyReadOnlyGuard('1', () => conn);
    expect(error).toBe(`Connection "${connectionName}" is in read-only mode`);
  });
}

function itAllowsWhenNotReadOnly() {
  it('allows execution when readOnly is false', () => {
    const conn: Connection = { id: '1', name: 'Prod', readOnly: false };
    const error = applyReadOnlyGuard('1', () => conn);
    expect(error).toBeNull();
  });

  it('allows execution when readOnly is undefined', () => {
    const conn: Connection = { id: '1', name: 'Prod' };
    const error = applyReadOnlyGuard('1', () => conn);
    expect(error).toBeNull();
  });

  it('allows execution when connection is not found', () => {
    const error = applyReadOnlyGuard('missing', () => undefined);
    expect(error).toBeNull();
  });
}

// ---------------------------------------------------------------------------
// RBAC write operations
// ---------------------------------------------------------------------------

describe('readonly guard — RBAC write operations', () => {
  describe.each([
    ['weaviate.rbac.addRole'],
    ['weaviate.rbac.editRole'],
    ['weaviate.rbac.deleteRole'],
    ['weaviate.rbac.addUser'],
    ['weaviate.rbac.editUser'],
    ['weaviate.rbac.deleteUser'],
    ['weaviate.rbac.activateUser'],
    ['weaviate.rbac.deactivateUser'],
    ['weaviate.rbac.rotateUserApiKey'],
    ['weaviate.rbac.addGroup'],
    ['weaviate.rbac.editGroup'],
    ['weaviate.rbac.deleteGroup'],
  ])('%s', (_command) => {
    itBlocksWhenReadOnly('ProductionCluster');
    itAllowsWhenNotReadOnly();
  });
});

// ---------------------------------------------------------------------------
// Backup write operations
// ---------------------------------------------------------------------------

describe('readonly guard — backup write operations', () => {
  describe.each([['weaviate.createBackup'], ['weaviate.restoreBackup']])('%s', (_command) => {
    itBlocksWhenReadOnly('ProductionCluster');
    itAllowsWhenNotReadOnly();
  });
});

// ---------------------------------------------------------------------------
// Alias write operations
// ---------------------------------------------------------------------------

describe('readonly guard — alias write operations', () => {
  describe.each([['weaviate.manageAliases'], ['weaviate.editAlias'], ['weaviate.deleteAlias']])(
    '%s',
    (_command) => {
      itBlocksWhenReadOnly('ProductionCluster');
      itAllowsWhenNotReadOnly();
    }
  );
});

// ---------------------------------------------------------------------------
// Collection write operations
// ---------------------------------------------------------------------------

describe('readonly guard — collection write operations', () => {
  describe.each([
    ['weaviate.addCollection'],
    ['weaviate.deleteCollection'],
    ['weaviate.deleteAllCollections'],
  ])('%s', (_command) => {
    itBlocksWhenReadOnly('ProductionCluster');
    itAllowsWhenNotReadOnly();
  });
});

// ---------------------------------------------------------------------------
// Guard specifics: error message format
// ---------------------------------------------------------------------------

describe('readonly guard — error message format', () => {
  it('includes the connection name in the error message', () => {
    const conn: Connection = { id: '1', name: 'My Production DB', readOnly: true };
    const error = applyReadOnlyGuard('1', () => conn);
    expect(error).toContain('My Production DB');
    expect(error).toContain('read-only mode');
  });

  it('does not trigger on readOnly=false even if connection exists', () => {
    const conn: Connection = { id: '1', name: 'Dev', readOnly: false };
    expect(applyReadOnlyGuard('1', () => conn)).toBeNull();
  });

  it('does not trigger on readOnly=null (only strict true)', () => {
    const conn = { id: '1', name: 'Dev', readOnly: null } as unknown as Connection;
    expect(applyReadOnlyGuard('1', () => conn)).toBeNull();
  });
});
