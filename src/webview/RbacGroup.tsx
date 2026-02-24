import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './RbacGroup.css';

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

function RbacGroupWebview() {
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [groupId, setGroupId] = useState('');
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [originalRoles, setOriginalRoles] = useState<Set<string>>(new Set());
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
          if (msg.mode === 'edit' && msg.existingGroup) {
            setGroupId(msg.existingGroup);
            const assigned = new Set<string>(msg.assignedRoles || []);
            setSelectedRoles(assigned);
            setOriginalRoles(new Set(assigned));
          }
          break;
        case 'groupSaved':
          setIsSubmitting(false);
          setSuccess(
            modeRef.current === 'add'
              ? 'Group roles assigned successfully!'
              : 'Group updated successfully!'
          );
          setError('');
          if (modeRef.current === 'add') {
            setGroupId('');
            setSelectedRoles(new Set());
          } else {
            setOriginalRoles((prev) => new Set(prev));
          }
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
    if (!groupId.trim()) {
      setError('Group ID is required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const rolesToAssign = [...selectedRoles].filter((r) => !originalRoles.has(r));
    const rolesToRevoke = [...originalRoles].filter((r) => !selectedRoles.has(r));

    vscode.postMessage({
      command: 'saveGroup',
      groupData: {
        groupId: groupId.trim(),
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
    <div className="rbac-group-container">
      <h1>{mode === 'add' ? 'Add Group' : 'Edit Group'}</h1>

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

      <div className="oidc-notice">
        <span className="codicon codicon-info"></span>
        Groups are managed by your OIDC identity provider (e.g., Keycloak, Okta, Auth0). Enter the
        group's identifier exactly as it appears in your identity provider.
      </div>

      <div className="form-section">
        <div className="form-group">
          <label htmlFor="groupId">Group ID</label>
          {mode === 'add' ? (
            <input
              type="text"
              id="groupId"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="e.g., admins or /realm/groups/data-team"
              disabled={isSubmitting}
              autoFocus
            />
          ) : (
            <div className="readonly-field">{groupId}</div>
          )}
        </div>

        <div className="form-group">
          <label>Assign Roles</label>
          {availableRoles.length === 0 ? (
            <div className="empty-roles">No roles available</div>
          ) : (
            <div className="roles-list">
              {availableRoles.map((role) => (
                <label
                  key={role}
                  className={`role-checkbox${selectedRoles.has(role) ? ' checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.has(role)}
                    onChange={() => toggleRole(role)}
                    disabled={isSubmitting}
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
          disabled={isSubmitting || !groupId.trim()}
        >
          {isSubmitting ? (
            <>
              <span className="codicon codicon-loading codicon-modifier-spin"></span>
              Saving...
            </>
          ) : (
            <>
              <span className="codicon codicon-check"></span>
              {mode === 'add' ? 'Assign Roles' : 'Save Changes'}
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
  root.render(<RbacGroupWebview />);
}
