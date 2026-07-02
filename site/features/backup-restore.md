---
title: Weaviate Backup & Restore — S3, GCS, Azure & Filesystem Backends
description: Create, monitor, and restore Weaviate backups across filesystem, S3, GCS, and Azure Blob Storage backends — backup management for self-hosted Weaviate in VS Code.
---

# Backup & Restore

Create, monitor, and restore backups across multiple storage backends — all from within VS Code.

## Supported Backends

| Backend        | Configuration                  |
| -------------- | ------------------------------ |
| **Filesystem** | Local disk path                |
| **S3**         | AWS S3 bucket with credentials |
| **GCS**        | Google Cloud Storage bucket    |
| **Azure**      | Azure Blob Storage container   |

The extension automatically detects available backup modules configured on your Weaviate instance.

## Creating Backups

1. Expand your connection in the sidebar
2. Click the **Create Backup** button (➕) in the Backups section
3. Configure backup options:
   - **Backend:** Choose from available backends
   - **Include collections:** Select specific collections or use wildcard (`*`) for all
   - **Exclude collections:** Omit certain collections
   - **Custom path:** Optional subfolder within the backend

### Wildcard Support

Use `*` to back up **all collections at once** — no need to individually select each one. This is especially useful for full-instance backups.

## Monitoring Backups

Backup status is shown in real-time:

| Status          | Indicator                      |
| --------------- | ------------------------------ |
| **In Progress** | Spinner with progress tracking |
| **Success**     | Green checkmark                |
| **Failed**      | Red X with error details       |

### Actions

- **Retry** failed backups
- **Cancel** in-progress backups — right-click an in-progress backup in the tree view and choose **Cancel Backup**; a confirmation dialog is shown before the cancellation is sent
- **Restore** from any completed backup

## Restoring Backups

1. Navigate to the **Backups** section under your connection
2. Click **Restore** (↻) on a successful backup
3. The restoration overwrites existing data — use with caution

## Independent Refresh

Each section in the backup panel has its own refresh control:

- Refresh backup list
- Refresh collections list (for backup creation)
- Refresh nodes status
- Refresh metadata

## Best Practices

- **Regular backups** — schedule them for production instances
- **Test restores** — periodically verify backups can be restored
- **Use wildcards** — for full-instance backup coverage
- **Monitor failures** — retry or investigate failed backups promptly
