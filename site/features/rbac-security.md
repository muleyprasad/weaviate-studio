---
title: RBAC & Security — Manage Weaviate Users, Roles & API Keys in VS Code
description: Create users, assign roles, manage groups, and rotate API keys for self-hosted Weaviate — full RBAC management from the Weaviate Studio VS Code extension.
---

# RBAC & Security

Weaviate Studio provides comprehensive Role-Based Access Control (RBAC) management and security features to protect your Weaviate instances.

## RBAC Management

Manage users, roles, and groups directly from the VS Code sidebar:

### Roles

- **Create roles** with specific permissions
- **Edit role permissions** with an intuitive UI
- **Delete roles** with confirmation
- **Built-in role support** — view and edit built-in Weaviate roles

### Users

- **Create users** with password-based OIDC or API key authentication
- **Edit user details** and role assignments
- **Activate/Deactivate** users to control access
- **Rotate API keys** with a single click
- Status indicators for active and inactive users

### Groups

- **Create groups** for efficient permission management
- **Edit group membership**
- **Delete groups** when no longer needed

## Read-Only Mode

Protect production data from accidental modifications:

- **Connection-level toggle** — enable read-only per connection
- **Visual indicators** in the tree view (lock icon)
- **All destructive operations blocked**:
  - Delete collections
  - Add/modify objects
  - Schema updates
  - Backup restore (but creation is allowed)

Toggle state is persisted per connection.

## API Key Security

- API keys are stored using **VS Code's Secret Storage** (OS-level keychain)
- Keys are **never displayed** when editing existing connections
- Cloud connections **require re-entry** when the target URL changes
- GraphQL fallback uses `Authorization: Bearer` headers when API key is present

## Tree View Integration

RBAC items appear in the sidebar tree under each connected instance:

```
Connection
├── Roles
│   ├── admin (built-in)
│   ├── viewer (built-in)
│   └── custom-role
├── Users
│   ├── user1 (Active)
│   └── user2 (Inactive)
└── Groups
    └── engineering-team
```

::: tip Quick Access
Use the inline action buttons (✏️ edit, 🗑️ delete, 🔄 rotate key, ✅ activate) on each RBAC item for fast management.
:::
