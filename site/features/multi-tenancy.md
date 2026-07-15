---
title: Multi-Tenancy Management — Tenant States, Auto-Tenant Flags & Bulk Operations
description: Manage Weaviate multi-tenant collections from VS Code — toggle auto-tenant flags, bulk activate/deactivate/offload/delete tenants by list or pattern, and reclaim memory from empty active tenants.
---

# Multi-Tenancy Management

Weaviate Studio provides full lifecycle management for multi-tenant collections — from configuration flags to bulk tenant-state operations.

## Edit Multi-Tenancy

Open from the **Multi Tenancy** node under any collection in the sidebar. The form lets you toggle:

| Flag                   | What it does                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `autoTenantCreation`   | Automatically create a tenant the first time data is written to it   |
| `autoTenantActivation` | Automatically load an INACTIVE tenant back into memory when accessed |

When either flag is off, the Multi Tenancy tree node shows a warning badge (`auto-tenant off`), and each flag row supports a right-click **Toggle** to flip it directly from the tree.

::: tip Why these flags matter
With `autoTenantCreation` off, clients must create tenants explicitly before inserting — a common source of "tenant not found" errors. With `autoTenantActivation` off, inactive tenants return "tenant is inactive" errors until manually reactivated.
:::

## Manage Tenants

Open from the **Multi Tenancy** node's context menu. Bulk-manage tenant states:

### Selecting Tenants

- **From list** — checkbox selection with filters:
  - By name (substring) or status (prefix, so `active` doesn't also match `INACTIVE`)
  - By object count: `count=0`, `count>1`, `count>=10`, `10<count<50`
- **By pattern** — wildcard (`*acme*`, `tenant-*`) or regex (`^tenant-\d+$`) with a live match preview before applying

The tenant list is **virtualized** — only visible rows render, so it stays smooth with thousands of tenants — and sorted naturally (`tenant-2` before `tenant-10`).

### Tenant States

| Target State | Effect                                    |
| ------------ | ----------------------------------------- |
| `ACTIVE`     | Load into memory                          |
| `INACTIVE`   | Offload to local disk (keeps the tenant)  |
| `OFFLOADED`  | Offload to cloud storage via `offload-s3` |

Tenants can also be **deleted** permanently. Every state change and deletion requires a modal confirmation.

::: warning Offload requirements
Setting tenants to `OFFLOADED` requires Weaviate **≥ 1.26.0** with the **`offload-s3`** module enabled and configured. The option is disabled in the UI when unsupported, and the extension re-validates server-side so the gate cannot be bypassed.
:::

### Object Counts

Per-tenant object counts come from verbose node status. Only ACTIVE (loaded) tenants report a count — INACTIVE/OFFLOADED tenants show `—` and are excluded while a count filter is active.

## Related Health Checks

The Cluster Panel's Checks tab includes two multi-tenancy checks:

- **Auto-Tenant Configuration** — lists collections with either auto-tenant flag off, with a one-click **Enable on all**
- **Empty Tenants (Active)** — lists ACTIVE tenants holding zero objects (wasting RAM), with per-collection **Inactivate** / **Delete** actions

See [Cluster Management](/features/cluster-management#health-checks) for details.

## Read-Only Connections

On read-only connections, all mutating controls are disabled, and the extension host independently rejects any mutation attempt — the read-only guard is enforced on both sides.
