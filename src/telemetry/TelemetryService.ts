/**
 * TelemetryService — minimal Phase 1 telemetry for Weaviate Studio.
 * Handles initialization, consent gating, and event sending.
 */

import * as vscode from 'vscode';
import { TelemetryReporter } from '@vscode/extension-telemetry';
import { TelemetryEventName, TelemetryErrorCategory, TELEMETRY_EVENTS } from './TelemetryTypes';
import { sanitizeProperties } from './TelemetrySanitizer';

export class TelemetryService {
  private reporter: TelemetryReporter | undefined;
  private sessionId: string;
  private extensionVersion: string;
  private activationTime: number;
  private isInitialized = false;

  constructor() {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.activationTime = Date.now();

    try {
      this.extensionVersion = require('../../package.json').version || 'unknown';
    } catch {
      this.extensionVersion = 'unknown';
    }
  }

  async initialize(connectionString?: string): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;

    const extensionEnabled = vscode.workspace
      .getConfiguration('weaviate')
      .get<boolean>('telemetry.enabled', true);

    if (!vscode.env.isTelemetryEnabled || !extensionEnabled) {
      return;
    }
    const telemetryKey = process.env.APPLICATION_INSIGHTS_CONN_STRING || connectionString;

    if (!telemetryKey) {
      return;
    }

    try {
      this.reporter = new TelemetryReporter(telemetryKey);
    } catch (error) {
      console.error('[Telemetry] Failed to initialize:', error);
    }
  }

  /**
   * Send a telemetry event with arbitrary properties.
   */
  trackUsage(eventName: TelemetryEventName, properties: Record<string, unknown> = {}): void {
    if (!this.reporter) {
      return;
    }

    const enriched: Record<string, unknown> = {
      ...properties,
      schemaVersion: '1.0.0',
      sessionId: this.sessionId,
      extensionVersion: this.extensionVersion,
      uiKind: vscode.env.uiKind === vscode.UIKind.Desktop ? 'desktop' : 'web',
      remoteName: vscode.env.remoteName || 'local',
      hostName: vscode.env.appName || 'unknown',
      hostVersion: vscode.version || 'unknown',
    };

    const sanitized = sanitizeProperties(enriched);

    try {
      this.reporter.sendTelemetryEvent(eventName, sanitized as Record<string, string>);
    } catch {
      // Swallow — telemetry must never break the extension.
    }
  }

  /**
   * Classify an error and send it as a telemetry event.
   */
  trackError(
    error: unknown,
    eventName: TelemetryEventName = TELEMETRY_EVENTS.EXTENSION_UNHANDLED_ERROR,
    extra: Record<string, unknown> = {}
  ): void {
    const category = classifyError(error);
    this.trackUsage(eventName, { ...extra, errorCategory: category });
  }

  sendActivatedEvent(): void {
    this.trackUsage(TELEMETRY_EVENTS.EXTENSION_ACTIVATED);
  }

  sendDeactivatedEvent(): void {
    this.trackUsage(TELEMETRY_EVENTS.EXTENSION_DEACTIVATED, {
      sessionDurationMs: Date.now() - this.activationTime,
    });
  }

  async dispose(): Promise<void> {
    this.sendDeactivatedEvent();
    if (this.reporter) {
      try {
        await this.reporter.dispose();
      } catch {
        // ignore
      }
      this.reporter = undefined;
    }
  }
}

const ERROR_PATTERNS: Array<{ pattern: RegExp; category: TelemetryErrorCategory }> = [
  { pattern: /validation|invalid|required|schema/i, category: 'validation' },
  { pattern: /authentication|unauthorized|401|api key|access denied/i, category: 'auth' },
  { pattern: /permission|forbidden|403/i, category: 'permission' },
  { pattern: /network|connection|econnrefused|enotfound/i, category: 'network' },
  { pattern: /timeout|timed out|etimedout/i, category: 'timeout' },
  { pattern: /server|50[0-4]|internal/i, category: 'server' },
  { pattern: /client|400|404|bad request|not found/i, category: 'client' },
];

function classifyError(error: unknown): TelemetryErrorCategory {
  if (!error) {
    return 'unknown';
  }

  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();

  for (const { pattern, category } of ERROR_PATTERNS) {
    if (pattern.test(msg)) {
      return category;
    }
  }

  return 'unknown';
}

// ── Singleton ──────────────────────────────────────────────

let instance: TelemetryService | undefined;

export function getTelemetryService(): TelemetryService {
  if (!instance) {
    instance = new TelemetryService();
  }
  return instance;
}

export async function disposeTelemetryService(): Promise<void> {
  if (instance) {
    await instance.dispose();
    instance = undefined;
  }
}
