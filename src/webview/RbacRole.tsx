import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import './RbacRole.css';

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

// ---- Types ----

interface PermissionConfig {
  collection?: string;
  tenant?: string;
  role?: string;
  user?: string;
  alias?: string;
  aliasCollection?: string;
  shard?: string;
  groupID?: string;
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
  manage?: boolean;
  assignAndRevoke?: boolean;
  create_collection?: boolean;
  read_config?: boolean;
  update_config?: boolean;
  delete_collection?: boolean;
}

// Each key holds an array of permission entries so multiple rules per resource are supported
interface PermissionsState {
  collections: PermissionConfig[];
  data: PermissionConfig[];
  backups: PermissionConfig[];
  tenants: PermissionConfig[];
  roles: PermissionConfig[];
  users: PermissionConfig[];
  aliases: PermissionConfig[];
  cluster: PermissionConfig[];
  nodesMinimal: PermissionConfig[];
  nodesVerbose: PermissionConfig[];
  replicate: PermissionConfig[];
  groupsOidc: PermissionConfig[];
}

// ---- Helpers ----

const DEFAULT_PERMISSIONS: PermissionsState = {
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

function roleToPermissionsState(role: any): PermissionsState {
  const state: PermissionsState = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
  if (!role) {
    return state;
  }

  state.collections = (role.collectionsPermissions || []).map((p: any) => {
    const a = p.actions || [];
    return {
      collection: p.collection || '*',
      create_collection: a.includes('create_collections'),
      read_config: a.includes('read_collections'),
      update_config: a.includes('update_collections'),
      delete_collection: a.includes('delete_collections'),
    };
  });

  state.data = (role.dataPermissions || []).map((p: any) => {
    const a = p.actions || [];
    return {
      collection: p.collection || '*',
      tenant: p.tenant || '*',
      create: a.includes('create_data'),
      read: a.includes('read_data'),
      update: a.includes('update_data'),
      delete: a.includes('delete_data'),
    };
  });

  state.backups = (role.backupsPermissions || []).map((p: any) => {
    const a = p.actions || [];
    return {
      collection: p.collection || '*',
      manage: a.includes('manage_backups'),
    };
  });

  state.tenants = (role.tenantsPermissions || []).map((p: any) => {
    const a = p.actions || [];
    return {
      collection: p.collection || '*',
      tenant: p.tenant || '*',
      create: a.includes('create_tenants'),
      read: a.includes('read_tenants'),
      update: a.includes('update_tenants'),
      delete: a.includes('delete_tenants'),
    };
  });

  state.roles = (role.rolesPermissions || []).map((p: any) => {
    const a = p.actions || [];
    return {
      role: p.role || '*',
      create: a.includes('create_roles'),
      read: a.includes('read_roles'),
      update: a.includes('update_roles'),
      delete: a.includes('delete_roles'),
    };
  });

  state.users = (role.usersPermissions || []).map((p: any) => {
    const a = p.actions || [];
    return {
      user: p.users || '*',
      read: a.includes('read_users'),
      assignAndRevoke: a.includes('assign_and_revoke_users'),
    };
  });

  state.aliases = (role.aliasPermissions || []).map((p: any) => {
    const a = p.actions || [];
    return {
      alias: p.alias || '*',
      aliasCollection: p.collection || '*',
      create: a.includes('create_aliases'),
      read: a.includes('read_aliases'),
      update: a.includes('update_aliases'),
      delete: a.includes('delete_aliases'),
    };
  });

  state.cluster = (role.clusterPermissions || []).map((p: any) => {
    const a = p.actions || [];
    return { read: a.includes('read_cluster') };
  });

  const nodesMinimal = (role.nodesPermissions || []).filter((p: any) => p.verbosity === 'minimal');
  state.nodesMinimal = nodesMinimal.map((p: any) => {
    const a = p.actions || [];
    return { read: a.includes('read_nodes') };
  });

  const nodesVerbose = (role.nodesPermissions || []).filter((p: any) => p.verbosity === 'verbose');
  state.nodesVerbose = nodesVerbose.map((p: any) => {
    const a = p.actions || [];
    return { collection: p.collection || '*', read: a.includes('read_nodes') };
  });

  state.replicate = (role.replicatePermissions || []).map((p: any) => {
    const a = p.actions || [];
    return {
      collection: p.collection || '*',
      shard: p.shard || '*',
      create: a.includes('create_replicate'),
      read: a.includes('read_replicate'),
      update: a.includes('update_replicate'),
      delete: a.includes('delete_replicate'),
    };
  });

  state.groupsOidc = (role.groupsPermissions || []).map((p: any) => {
    const a = p.actions || [];
    return {
      groupID: p.groupID || '*',
      read: a.includes('read_groups'),
      assignAndRevoke: a.includes('assign_and_revoke_groups'),
    };
  });

  return state;
}

function countActions(cfg: PermissionConfig): number {
  return [
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
}

function totalActions(cfgs: PermissionConfig[]): number {
  return cfgs.reduce((sum, c) => sum + countActions(c), 0);
}

// ---- Sub-components ----

interface FilterFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}
function FilterField({ label, value, onChange }: FilterFieldProps) {
  return (
    <div className="filter-field">
      <label>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="* (all)"
      />
    </div>
  );
}

interface ActionCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}
function ActionCheckbox({ label, checked, onChange }: ActionCheckboxProps) {
  return (
    <label className={`action-checkbox${checked ? ' checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

interface PermSectionProps {
  title: string;
  configs: PermissionConfig[];
  defaultEntry: PermissionConfig;
  onChange: (configs: PermissionConfig[]) => void;
  hasError?: boolean;
  children: (cfg: PermissionConfig, set: (cfg: PermissionConfig) => void) => React.ReactNode;
}
function PermSection({
  title,
  configs,
  defaultEntry,
  onChange,
  hasError,
  children,
}: PermSectionProps) {
  const total = totalActions(configs);
  const [open, setOpen] = useState(configs.length > 0);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Auto-expand when entries arrive (e.g. initData in edit mode)
  useEffect(() => {
    if (configs.length > 0) {
      setOpen(true);
    }
  }, [configs.length]);

  // Auto-expand and scroll into view when an error is flagged
  useEffect(() => {
    if (hasError) {
      setOpen(true);
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [hasError]);

  const addEntry = () => {
    onChange([...configs, { ...defaultEntry }]);
    setOpen(true);
  };

  const removeEntry = (idx: number) => {
    onChange(configs.filter((_, i) => i !== idx));
  };

  const updateEntry = (idx: number, cfg: PermissionConfig) => {
    const next = [...configs];
    next[idx] = cfg;
    onChange(next);
  };

  return (
    <div ref={sectionRef} className={`permission-section${hasError ? ' has-error' : ''}`}>
      <div className="permission-header" onClick={() => setOpen((v) => !v)}>
        <span className={`toggle-arrow${open ? ' open' : ''}`}>▶</span>
        <span className="perm-label">{title}</span>
        {hasError && <span className="perm-status error-badge">action required</span>}
        {!hasError && configs.length > 0 ? (
          <span className="perm-status configured">
            {configs.length} rule{configs.length !== 1 ? 's' : ''}, {total} action
            {total !== 1 ? 's' : ''}
          </span>
        ) : !hasError ? (
          <span className="perm-status">disabled</span>
        ) : null}
      </div>
      {open && (
        <div className="permission-body">
          {configs.map((cfg, idx) => (
            <div
              key={idx}
              className={`permission-entry${hasError && countActions(cfg) === 0 ? ' entry-error' : ''}`}
            >
              <button
                className="remove-entry-btn"
                onClick={() => removeEntry(idx)}
                title="Remove this permission rule"
              >
                ×
              </button>
              {children(cfg, (newCfg) => updateEntry(idx, newCfg))}
              {hasError && countActions(cfg) === 0 && (
                <div className="entry-error-msg">Select at least one action</div>
              )}
            </div>
          ))}
          <button className="add-entry-btn" onClick={addEntry}>
            + Add {title} rule
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Main Component ----

const BUILTIN_ROLES = new Set(['admin', 'root', 'read-only', 'viewer']);

function RbacRoleWebview() {
  const [mode, setMode] = useState<'add' | 'edit'>('add');
  const [roleName, setRoleName] = useState('');
  const [isBuiltinRole, setIsBuiltinRole] = useState(false);
  const [permissions, setPermissions] = useState<PermissionsState>(DEFAULT_PERMISSIONS);
  const [sectionErrors, setSectionErrors] = useState<Set<keyof PermissionsState>>(new Set());
  const [groupAssignments, setGroupAssignments] = useState<
    { groupID: string; groupType?: string }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const modeRef = React.useRef<'add' | 'edit'>('add');
  const errorRef = useRef<HTMLDivElement>(null);

  // Scroll the top-level error banner into view whenever it is set
  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [error]);

  const updatePerm = useCallback(
    (key: keyof PermissionsState) => (configs: PermissionConfig[]) => {
      setPermissions((prev) => ({ ...prev, [key]: configs }));
      // Clear the error flag for this section as soon as the user makes a change
      setSectionErrors((prev) => {
        if (!prev.has(key)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      switch (msg.command) {
        case 'initData':
          modeRef.current = msg.mode || 'add';
          setMode(msg.mode || 'add');
          if (msg.mode === 'edit' && msg.existingRole) {
            const name = msg.existingRole.name || '';
            setRoleName(name);
            setIsBuiltinRole(BUILTIN_ROLES.has(name));
            setPermissions(roleToPermissionsState(msg.existingRole));
            setGroupAssignments(msg.groupAssignments || []);
          }
          break;
        case 'roleSaved':
          setIsSubmitting(false);
          setSuccess(
            modeRef.current === 'add' ? 'Role created successfully!' : 'Role updated successfully!'
          );
          setError('');
          setSectionErrors(new Set());
          if (modeRef.current === 'add') {
            setRoleName('');
            setPermissions(DEFAULT_PERMISSIONS);
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

  const handleSave = () => {
    if (!roleName.trim()) {
      setError('Role name is required');
      return;
    }

    // Validate: editing a role with zero rules would silently delete all permissions
    const totalRules = Object.values(permissions).reduce((sum, arr) => sum + arr.length, 0);
    if (mode === 'edit' && totalRules === 0) {
      setError(
        'Cannot save a role with no permission rules. Add at least one rule, or delete the role explicitly.'
      );
      return;
    }

    // Validate: every rule must have at least one action selected
    const SECTION_TITLES: Array<{ key: keyof PermissionsState; title: string }> = [
      { key: 'collections', title: 'Collections' },
      { key: 'data', title: 'Data' },
      { key: 'backups', title: 'Backups' },
      { key: 'tenants', title: 'Tenants' },
      { key: 'roles', title: 'Roles' },
      { key: 'users', title: 'Users' },
      { key: 'aliases', title: 'Aliases' },
      { key: 'cluster', title: 'Cluster' },
      { key: 'nodesMinimal', title: 'Nodes (Minimal)' },
      { key: 'nodesVerbose', title: 'Nodes (Verbose)' },
      { key: 'replicate', title: 'Replicate' },
      { key: 'groupsOidc', title: 'Groups (OIDC)' },
    ];
    const emptyRules: string[] = [];
    const badSections = new Set<keyof PermissionsState>();
    for (const { key, title } of SECTION_TITLES) {
      permissions[key].forEach((cfg, i) => {
        if (countActions(cfg) === 0) {
          emptyRules.push(`"${title}" rule ${i + 1}`);
          badSections.add(key);
        }
      });
    }
    if (emptyRules.length > 0) {
      setSectionErrors(badSections);
      setError(
        `Each rule must have at least one action selected. Fix or remove: ${emptyRules.join(', ')}.`
      );
      return;
    }
    setSectionErrors(new Set());

    setIsSubmitting(true);
    setError('');
    setSuccess('');
    vscode.postMessage({
      command: 'saveRole',
      roleData: { name: roleName.trim(), permissions, mode },
    });
  };

  const handleCancel = () => {
    vscode.postMessage({ command: 'cancel' });
  };

  return (
    <div className="rbac-role-container">
      <h1>{mode === 'add' ? 'Add Role' : 'Edit Role'}</h1>

      {error && (
        <div ref={errorRef} className="message error-message">
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

      {isBuiltinRole && (
        <div className="warning-note">
          <span className="codicon codicon-lock"></span> <strong>Built-in role</strong> — This is a
          system role and cannot be modified.
        </div>
      )}
      {mode === 'edit' && !isBuiltinRole && (
        <div className="warning-note">
          Editing a role replaces its existing permissions. User role assignments are preserved.
        </div>
      )}

      <div className="form-section">
        <div className="form-group">
          <label htmlFor="roleName">Role Name</label>
          <input
            type="text"
            id="roleName"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            placeholder="e.g., data-reader"
            disabled={mode === 'edit' || isSubmitting}
            autoFocus={mode === 'add'}
          />
        </div>
      </div>

      {mode === 'edit' && groupAssignments.length > 0 && (
        <div className="form-section">
          <div className="form-group">
            <label>Assigned Groups ({groupAssignments.length})</label>
            <div className="group-assignments-list">
              {groupAssignments.map((g, i) => (
                <div key={i} className="group-assignment-item">
                  <span className="codicon codicon-organization"></span>
                  <span className="group-id">{g.groupID}</span>
                  {g.groupType && <span className="group-type">{g.groupType}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="form-section">
        <h3 className="permissions-title">Permissions</h3>
        <p className="info-note">
          Click a section to add rules. Each rule targets a specific resource scope. Use{' '}
          <code>*</code> to match all resources.
        </p>

        <PermSection
          title="Aliases"
          configs={permissions.aliases}
          defaultEntry={{ alias: '*', aliasCollection: '*' }}
          onChange={updatePerm('aliases')}
          hasError={sectionErrors.has('aliases')}
        >
          {(cfg, set) => (
            <>
              <div className="filter-group">
                <FilterField
                  label="Alias"
                  value={cfg.alias || '*'}
                  onChange={(v) => set({ ...cfg, alias: v })}
                />
                <FilterField
                  label="Collection"
                  value={cfg.aliasCollection || '*'}
                  onChange={(v) => set({ ...cfg, aliasCollection: v })}
                />
              </div>
              <div className="actions-group">
                {(['create', 'read', 'update', 'delete'] as const).map((a) => (
                  <ActionCheckbox
                    key={a}
                    label={a.charAt(0).toUpperCase() + a.slice(1)}
                    checked={!!cfg[a]}
                    onChange={(v) => set({ ...cfg, [a]: v })}
                  />
                ))}
              </div>
            </>
          )}
        </PermSection>

        <PermSection
          title="Backups"
          configs={permissions.backups}
          defaultEntry={{ collection: '*' }}
          onChange={updatePerm('backups')}
          hasError={sectionErrors.has('backups')}
        >
          {(cfg, set) => (
            <>
              <div className="filter-group">
                <FilterField
                  label="Collection"
                  value={cfg.collection || '*'}
                  onChange={(v) => set({ ...cfg, collection: v })}
                />
              </div>
              <div className="actions-group">
                <ActionCheckbox
                  label="Manage"
                  checked={!!cfg.manage}
                  onChange={(v) => set({ ...cfg, manage: v })}
                />
              </div>
            </>
          )}
        </PermSection>

        <PermSection
          title="Cluster"
          configs={permissions.cluster}
          defaultEntry={{}}
          onChange={updatePerm('cluster')}
          hasError={sectionErrors.has('cluster')}
        >
          {(cfg, set) => (
            <div className="actions-group">
              <ActionCheckbox
                label="Read"
                checked={!!cfg.read}
                onChange={(v) => set({ ...cfg, read: v })}
              />
            </div>
          )}
        </PermSection>

        <PermSection
          title="Collections"
          configs={permissions.collections}
          defaultEntry={{ collection: '*' }}
          onChange={updatePerm('collections')}
          hasError={sectionErrors.has('collections')}
        >
          {(cfg, set) => (
            <>
              <div className="filter-group">
                <FilterField
                  label="Collection"
                  value={cfg.collection || '*'}
                  onChange={(v) => set({ ...cfg, collection: v })}
                />
              </div>
              <div className="actions-group">
                <ActionCheckbox
                  label="Create"
                  checked={!!cfg.create_collection}
                  onChange={(v) => set({ ...cfg, create_collection: v })}
                />
                <ActionCheckbox
                  label="Read config"
                  checked={!!cfg.read_config}
                  onChange={(v) => set({ ...cfg, read_config: v })}
                />
                <ActionCheckbox
                  label="Update config"
                  checked={!!cfg.update_config}
                  onChange={(v) => set({ ...cfg, update_config: v })}
                />
                <ActionCheckbox
                  label="Delete"
                  checked={!!cfg.delete_collection}
                  onChange={(v) => set({ ...cfg, delete_collection: v })}
                />
              </div>
            </>
          )}
        </PermSection>

        <PermSection
          title="Data"
          configs={permissions.data}
          defaultEntry={{ collection: '*', tenant: '*' }}
          onChange={updatePerm('data')}
          hasError={sectionErrors.has('data')}
        >
          {(cfg, set) => (
            <>
              <div className="filter-group">
                <FilterField
                  label="Collection"
                  value={cfg.collection || '*'}
                  onChange={(v) => set({ ...cfg, collection: v })}
                />
                <FilterField
                  label="Tenant"
                  value={cfg.tenant || '*'}
                  onChange={(v) => set({ ...cfg, tenant: v })}
                />
              </div>
              <div className="actions-group">
                {(['create', 'read', 'update', 'delete'] as const).map((a) => (
                  <ActionCheckbox
                    key={a}
                    label={a.charAt(0).toUpperCase() + a.slice(1)}
                    checked={!!cfg[a]}
                    onChange={(v) => set({ ...cfg, [a]: v })}
                  />
                ))}
              </div>
            </>
          )}
        </PermSection>

        <PermSection
          title="Groups (OIDC)"
          configs={permissions.groupsOidc}
          defaultEntry={{ groupID: '*' }}
          onChange={updatePerm('groupsOidc')}
          hasError={sectionErrors.has('groupsOidc')}
        >
          {(cfg, set) => (
            <>
              <div className="filter-group">
                <FilterField
                  label="Group ID"
                  value={cfg.groupID || '*'}
                  onChange={(v) => set({ ...cfg, groupID: v })}
                />
              </div>
              <div className="actions-group">
                <ActionCheckbox
                  label="Read"
                  checked={!!cfg.read}
                  onChange={(v) => set({ ...cfg, read: v })}
                />
                <ActionCheckbox
                  label="Assign & Revoke"
                  checked={!!cfg.assignAndRevoke}
                  onChange={(v) => set({ ...cfg, assignAndRevoke: v })}
                />
              </div>
            </>
          )}
        </PermSection>

        <PermSection
          title="Nodes (Minimal)"
          configs={permissions.nodesMinimal}
          defaultEntry={{}}
          onChange={updatePerm('nodesMinimal')}
          hasError={sectionErrors.has('nodesMinimal')}
        >
          {(cfg, set) => (
            <div className="actions-group">
              <ActionCheckbox
                label="Read"
                checked={!!cfg.read}
                onChange={(v) => set({ ...cfg, read: v })}
              />
            </div>
          )}
        </PermSection>

        <PermSection
          title="Nodes (Verbose)"
          configs={permissions.nodesVerbose}
          defaultEntry={{ collection: '*' }}
          onChange={updatePerm('nodesVerbose')}
          hasError={sectionErrors.has('nodesVerbose')}
        >
          {(cfg, set) => (
            <>
              <div className="filter-group">
                <FilterField
                  label="Collection"
                  value={cfg.collection || '*'}
                  onChange={(v) => set({ ...cfg, collection: v })}
                />
              </div>
              <div className="actions-group">
                <ActionCheckbox
                  label="Read"
                  checked={!!cfg.read}
                  onChange={(v) => set({ ...cfg, read: v })}
                />
              </div>
            </>
          )}
        </PermSection>

        <PermSection
          title="Replicate"
          configs={permissions.replicate}
          defaultEntry={{ collection: '*', shard: '*' }}
          onChange={updatePerm('replicate')}
          hasError={sectionErrors.has('replicate')}
        >
          {(cfg, set) => (
            <>
              <div className="filter-group">
                <FilterField
                  label="Collection"
                  value={cfg.collection || '*'}
                  onChange={(v) => set({ ...cfg, collection: v })}
                />
                <FilterField
                  label="Shard"
                  value={cfg.shard || '*'}
                  onChange={(v) => set({ ...cfg, shard: v })}
                />
              </div>
              <div className="actions-group">
                {(['create', 'read', 'update', 'delete'] as const).map((a) => (
                  <ActionCheckbox
                    key={a}
                    label={a.charAt(0).toUpperCase() + a.slice(1)}
                    checked={!!cfg[a]}
                    onChange={(v) => set({ ...cfg, [a]: v })}
                  />
                ))}
              </div>
            </>
          )}
        </PermSection>

        <PermSection
          title="Roles"
          configs={permissions.roles}
          defaultEntry={{ role: '*' }}
          onChange={updatePerm('roles')}
          hasError={sectionErrors.has('roles')}
        >
          {(cfg, set) => (
            <>
              <div className="filter-group">
                <FilterField
                  label="Role"
                  value={cfg.role || '*'}
                  onChange={(v) => set({ ...cfg, role: v })}
                />
              </div>
              <div className="actions-group">
                {(['create', 'read', 'update', 'delete'] as const).map((a) => (
                  <ActionCheckbox
                    key={a}
                    label={a.charAt(0).toUpperCase() + a.slice(1)}
                    checked={!!cfg[a]}
                    onChange={(v) => set({ ...cfg, [a]: v })}
                  />
                ))}
              </div>
            </>
          )}
        </PermSection>

        <PermSection
          title="Tenants"
          configs={permissions.tenants}
          defaultEntry={{ collection: '*', tenant: '*' }}
          onChange={updatePerm('tenants')}
          hasError={sectionErrors.has('tenants')}
        >
          {(cfg, set) => (
            <>
              <div className="filter-group">
                <FilterField
                  label="Collection"
                  value={cfg.collection || '*'}
                  onChange={(v) => set({ ...cfg, collection: v })}
                />
                <FilterField
                  label="Tenant"
                  value={cfg.tenant || '*'}
                  onChange={(v) => set({ ...cfg, tenant: v })}
                />
              </div>
              <div className="actions-group">
                {(['create', 'read', 'update', 'delete'] as const).map((a) => (
                  <ActionCheckbox
                    key={a}
                    label={a.charAt(0).toUpperCase() + a.slice(1)}
                    checked={!!cfg[a]}
                    onChange={(v) => set({ ...cfg, [a]: v })}
                  />
                ))}
              </div>
            </>
          )}
        </PermSection>

        <PermSection
          title="Users"
          configs={permissions.users}
          defaultEntry={{ user: '*' }}
          onChange={updatePerm('users')}
          hasError={sectionErrors.has('users')}
        >
          {(cfg, set) => (
            <>
              <div className="filter-group">
                <FilterField
                  label="User"
                  value={cfg.user || '*'}
                  onChange={(v) => set({ ...cfg, user: v })}
                />
              </div>
              <div className="actions-group">
                <ActionCheckbox
                  label="Read"
                  checked={!!cfg.read}
                  onChange={(v) => set({ ...cfg, read: v })}
                />
                <ActionCheckbox
                  label="Assign & Revoke"
                  checked={!!cfg.assignAndRevoke}
                  onChange={(v) => set({ ...cfg, assignAndRevoke: v })}
                />
              </div>
            </>
          )}
        </PermSection>
      </div>

      <div className="button-group">
        {!isBuiltinRole && (
          <button
            className="primary-button"
            onClick={handleSave}
            disabled={isSubmitting || !roleName.trim()}
          >
            {isSubmitting ? (
              <>
                <span className="codicon codicon-loading codicon-modifier-spin"></span>
                Saving...
              </>
            ) : (
              <>
                <span className="codicon codicon-check"></span>
                {mode === 'add' ? 'Create Role' : 'Save Changes'}
              </>
            )}
          </button>
        )}
        <button className="secondary-button" onClick={handleCancel} disabled={isSubmitting}>
          {isBuiltinRole ? 'Close' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<RbacRoleWebview />);
}
