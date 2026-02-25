import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './RbacUser.css';

declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    };
  }
}

let vscode: any;
try {
  vscode = window.acquireVsCodeApi();
} catch (error) {
  console.error('Failed to acquire VS Code API', error);
}

function RbacUserWebview() {
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [userId, setUserId] = useState('');
  const [isEnvUser, setIsEnvUser] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [originalRoles, setOriginalRoles] = useState<Set<string>>(new Set());
  const selectedRolesRef = React.useRef<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const modeRef = React.useRef<'add' | 'edit'>('add');

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.command) {
        case 'initData':
          modeRef.current = msg.mode || 'add';
          setMode(msg.mode || 'add');
          const roles: string[] = (msg.availableRoles || []).sort((a: string, b: string) =>
            a.localeCompare(b)
          );
          setAvailableRoles(roles);
          if (msg.mode === 'edit' && msg.existingUser) {
            setUserId(msg.existingUser.id || '');
            const envUser = msg.existingUser.userType === 'db_env_user';
            setIsEnvUser(envUser);
            const assigned = new Set<string>(msg.assignedRoles || []);
            setSelectedRoles(assigned);
            setOriginalRoles(new Set(assigned));
          }
          break;
        case 'userSaved':
          setIsSubmitting(false);
          setSuccess(
            modeRef.current === 'add' ? 'User created successfully!' : 'User updated successfully!'
          );
          setError('');
          if (modeRef.current === 'add') {
            setUserId('');
            setSelectedRoles(new Set());
          } else {
            // Advance the baseline to the roles that were just successfully saved
            setOriginalRoles(new Set(selectedRolesRef.current));
          }
          break;
        case 'rolesUpdated':
          setAvailableRoles(
            (msg.availableRoles || []).sort((a: string, b: string) => a.localeCompare(b))
          );
          break;
        case 'error':
          setIsSubmitting(false);
          setError(msg.message || 'An unknown error occurred');
          setSuccess('');
          break;
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ command: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  // Keep ref in sync so the stale-closed message handler can read the current value
  useEffect(() => {
    selectedRolesRef.current = selectedRoles;
  }, [selectedRoles]);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  const handleSave = () => {
    if (isEnvUser) {
      return;
    }
    if (!userId.trim()) {
      setError('User ID is required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const rolesToAssign = [...selectedRoles].filter((r) => !originalRoles.has(r));
    const rolesToRevoke = [...originalRoles].filter((r) => !selectedRoles.has(r));

    vscode.postMessage({
      command: 'saveUser',
      userData: {
        userId: userId.trim(),
        rolesToAssign,
        rolesToRevoke,
        mode,
      },
    });
  };

  const handleCancel = () => {
    vscode.postMessage({ command: 'cancel' });
  };

  return (
    <div className="rbac-user-container">
      <h1>{mode === 'add' ? 'Add User' : 'Edit User'}</h1>

      {error && (
        <div className="message error-message">
          <span className="codicon codicon-error"></span>
          {error}
        </div>
      )}
      {success && (
        <div className="message success-message">
          <span className="codicon codicon-check"></span>
          {success}
        </div>
      )}

      {isEnvUser && (
        <div className="warning-note">
          <span className="codicon codicon-lock"></span> <strong>Environment variable user</strong>{' '}
          — This user is defined in the server's environment variables and cannot be modified
          through the API.
        </div>
      )}

      <div className="form-section">
        <div className="form-group">
          <label htmlFor="userId">User ID</label>
          {mode === 'add' ? (
            <input
              type="text"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="e.g., custom-user"
              disabled={isSubmitting}
              autoFocus
            />
          ) : (
            <div className="readonly-field">{userId}</div>
          )}
        </div>

        {mode === 'add' && (
          <div className="api-key-notice">
            A new API key will be generated for this user. It will be shown once after creation —
            make sure to copy it immediately.
          </div>
        )}

        <div className="form-group">
          <label>Assign Roles</label>
          {availableRoles.length === 0 ? (
            <div className="empty-roles">No roles available</div>
          ) : (
            <div className="roles-list">
              {availableRoles.map((role) => (
                <label
                  key={role}
                  className={`role-checkbox${selectedRoles.has(role) ? ' checked' : ''}${isEnvUser ? ' disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.has(role)}
                    onChange={() => toggleRole(role)}
                    disabled={isSubmitting || isEnvUser}
                  />
                  {role}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="button-group">
        <button
          className="primary-button"
          onClick={handleSave}
          disabled={isSubmitting || !userId.trim() || isEnvUser}
        >
          {isSubmitting ? (
            <>
              <span className="codicon codicon-loading codicon-modifier-spin"></span>
              Saving...
            </>
          ) : (
            <>
              <span className="codicon codicon-check"></span>
              {mode === 'add' ? 'Create User' : 'Save Changes'}
            </>
          )}
        </button>
        <button className="secondary-button" onClick={handleCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<RbacUserWebview />);
}
