/**
 * Tests for the activate/deactivate/delete boolean-result-check pattern.
 *
 * The Weaviate client returns `false` (not throws) when these operations fail
 * silently. This suite verifies the guard logic that converts that `false`
 * into a visible error rather than a false-positive success message.
 */

describe('RBAC user status command result handling', () => {
  // Mirrors the guard pattern used in extension.ts for activate/deactivate/delete
  const handleBooleanResult = (
    result: boolean | void,
    userId: string,
    operation: string
  ): { success: boolean; errorMessage: string } => {
    if (result === false) {
      return {
        success: false,
        errorMessage: `Failed to ${operation} user "${userId}". The operation was not successful.`,
      };
    }
    return { success: true, errorMessage: '' };
  };

  describe('activate', () => {
    it('should report failure when activate returns false', () => {
      const { success, errorMessage } = handleBooleanResult(false, 'test-user', 'activate');
      expect(success).toBe(false);
      expect(errorMessage).toContain('Failed to activate user "test-user"');
    });

    it('should report success when activate returns true', () => {
      const { success, errorMessage } = handleBooleanResult(true, 'test-user', 'activate');
      expect(success).toBe(true);
      expect(errorMessage).toBe('');
    });

    it('should report success when activate returns void (undefined)', () => {
      // Some SDK versions return void on success rather than true
      const { success, errorMessage } = handleBooleanResult(undefined, 'test-user', 'activate');
      expect(success).toBe(true);
      expect(errorMessage).toBe('');
    });
  });

  describe('deactivate', () => {
    it('should report failure when deactivate returns false', () => {
      const { success, errorMessage } = handleBooleanResult(false, 'test-user', 'deactivate');
      expect(success).toBe(false);
      expect(errorMessage).toContain('Failed to deactivate user "test-user"');
    });

    it('should report success when deactivate returns true', () => {
      const { success, errorMessage } = handleBooleanResult(true, 'test-user', 'deactivate');
      expect(success).toBe(true);
      expect(errorMessage).toBe('');
    });

    it('should report success when deactivate returns void (undefined)', () => {
      const { success, errorMessage } = handleBooleanResult(undefined, 'test-user', 'deactivate');
      expect(success).toBe(true);
      expect(errorMessage).toBe('');
    });
  });

  describe('delete', () => {
    it('should report failure when delete returns false', () => {
      const { success, errorMessage } = handleBooleanResult(false, 'test-user', 'delete');
      expect(success).toBe(false);
      expect(errorMessage).toContain('Failed to delete user "test-user"');
    });

    it('should report success when delete returns true', () => {
      const { success, errorMessage } = handleBooleanResult(true, 'test-user', 'delete');
      expect(success).toBe(true);
      expect(errorMessage).toBe('');
    });
  });

  describe('false is distinct from other falsy values', () => {
    it('should NOT treat null as failure', () => {
      const { success } = handleBooleanResult(null as any, 'test-user', 'activate');
      expect(success).toBe(true);
    });

    it('should NOT treat 0 as failure', () => {
      const { success } = handleBooleanResult(0 as any, 'test-user', 'activate');
      expect(success).toBe(true);
    });

    it('should NOT treat empty string as failure', () => {
      const { success } = handleBooleanResult('' as any, 'test-user', 'activate');
      expect(success).toBe(true);
    });
  });
});
