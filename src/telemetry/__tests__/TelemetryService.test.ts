import { TelemetryService } from '../TelemetryService';
import { TELEMETRY_EVENTS } from '../TelemetryTypes';

describe('TelemetryService', () => {
  it('should generate a unique session ID on construction', () => {
    const service = new TelemetryService();
    expect(service['sessionId']).toMatch(/^session_/);
  });

  it('should generate different session IDs per instance', () => {
    const a = new TelemetryService();
    const b = new TelemetryService();
    expect(a['sessionId']).not.toBe(b['sessionId']);
  });

  it('should not throw when tracking before initialization', () => {
    const service = new TelemetryService();
    expect(() => service.trackUsage(TELEMETRY_EVENTS.EXTENSION_ACTIVATED)).not.toThrow();
  });

  it('should not throw when tracking errors before initialization', () => {
    const service = new TelemetryService();
    expect(() => service.trackError(new Error('boom'))).not.toThrow();
  });
});

describe('TELEMETRY_EVENTS', () => {
  it('should define the Phase 1 event names', () => {
    expect(TELEMETRY_EVENTS.EXTENSION_ACTIVATED).toBe('extension.activated');
    expect(TELEMETRY_EVENTS.EXTENSION_DEACTIVATED).toBe('extension.deactivated');
    expect(TELEMETRY_EVENTS.EXTENSION_UNHANDLED_ERROR).toBe('extension.unhandledError');
    expect(TELEMETRY_EVENTS.CONNECTION_CONNECT_COMPLETED).toBe('connection.connectCompleted');
    expect(TELEMETRY_EVENTS.DATA_EXPLORER_OPENED).toBe('dataExplorer.opened');
    expect(TELEMETRY_EVENTS.QUERY_EDITOR_QUERY_COMPLETED).toBe('queryEditor.queryCompleted');
    expect(TELEMETRY_EVENTS.RAG_CHAT_REQUEST_COMPLETED).toBe('ragChat.requestCompleted');
  });

  it('should have exactly 19 events', () => {
    expect(Object.keys(TELEMETRY_EVENTS)).toHaveLength(19);
  });
});
