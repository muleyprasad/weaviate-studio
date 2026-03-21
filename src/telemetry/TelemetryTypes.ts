/**
 * Telemetry types for Weaviate Studio — Phase 1 (minimal)
 */

export type TelemetryResult = 'success' | 'failure' | 'cancelled';

export type TelemetryErrorCategory =
  | 'validation'
  | 'auth'
  | 'permission'
  | 'network'
  | 'timeout'
  | 'server'
  | 'client'
  | 'unknown';

/**
 * Phase 1 event names — only the events we actually consume in dashboards.
 */
export const TELEMETRY_EVENTS = {
  // Lifecycle events
  EXTENSION_ACTIVATED: 'extension.activated',
  EXTENSION_DEACTIVATED: 'extension.deactivated',
  EXTENSION_UNHANDLED_ERROR: 'extension.unhandledError',

  // Feature opened events (user activated the feature)
  DATA_EXPLORER_OPENED: 'dataExplorer.opened',
  QUERY_EDITOR_OPENED: 'queryEditor.opened',
  RAG_CHAT_OPENED: 'ragChat.opened',
  COLLECTION_CREATE_OPENED: 'collection.createOpened',
  BACKUP_OPENED: 'backup.opened',
  BACKUP_RESTORE_OPENED: 'backup.restoreOpened',
  CLUSTER_OPENED: 'cluster.opened',
  ALIAS_OPENED: 'alias.opened',
  RBAC_ROLE_OPENED: 'rbac.roleOpened',
  RBAC_USER_OPENED: 'rbac.userOpened',
  RBAC_GROUP_OPENED: 'rbac.groupOpened',

  // Feature operation events (user performed an action)
  CONNECTION_CONNECT_COMPLETED: 'connection.connectCompleted',
  QUERY_EDITOR_QUERY_COMPLETED: 'queryEditor.queryCompleted',
  RAG_CHAT_REQUEST_COMPLETED: 'ragChat.requestCompleted',
  COLLECTION_CREATE_COMPLETED: 'collection.createCompleted',
  BACKUP_COMPLETED: 'backup.completed',
} as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[keyof typeof TELEMETRY_EVENTS];
