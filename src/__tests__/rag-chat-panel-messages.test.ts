import { clampLimit, RequestTracker } from '../rag-chat/extension/utils';

describe('RagChatPanel message handling utils', () => {
  describe('clampLimit', () => {
    it('clamps values below 1 to 1', () => {
      expect(clampLimit(0)).toBe(1);
      expect(clampLimit(-5)).toBe(1);
    });

    it('clamps values above 100 to 100', () => {
      expect(clampLimit(101)).toBe(100);
      expect(clampLimit(500)).toBe(100);
    });

    it('passes valid values unchanged', () => {
      expect(clampLimit(1)).toBe(1);
      expect(clampLimit(50)).toBe(50);
      expect(clampLimit(100)).toBe(100);
    });

    it('uses default value if undefined', () => {
      expect(clampLimit(undefined)).toBe(5);
      expect(clampLimit(undefined, 10)).toBe(10);
    });
  });

  describe('RequestTracker', () => {
    let tracker: RequestTracker;

    beforeEach(() => {
      tracker = new RequestTracker();
    });

    it('tracks requests and identifies stale vs active', () => {
      tracker.track('req-1');
      tracker.track('req-2');

      expect(tracker.isStale('req-1')).toBe(false);
      expect(tracker.isStale('req-2')).toBe(false);
      expect(tracker.isStale('req-3')).toBe(true); // Never tracked
    });

    it('identifies un-tracked requests as stale', () => {
      expect(tracker.isStale('req-1')).toBe(true);
    });

    it('marks completed requests as stale', () => {
      tracker.track('req-1');
      tracker.complete('req-1');

      expect(tracker.isStale('req-1')).toBe(true);
    });

    it('handles undefined request IDs safely', () => {
      tracker.track(undefined);
      expect(tracker.isStale(undefined)).toBe(false); // undefined is ignored/passes through
      tracker.complete(undefined);
    });
  });
});
