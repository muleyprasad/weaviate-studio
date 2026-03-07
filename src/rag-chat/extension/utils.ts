export function clampLimit(limit: number | undefined, defaultLimit: number = 5): number {
  return Math.max(1, Math.min(100, limit ?? defaultLimit));
}

export class RequestTracker {
  private _activeRequests: Set<string> = new Set();

  track(requestId: string | undefined): void {
    if (requestId) {
      this._activeRequests.add(requestId);
    }
  }

  isStale(requestId: string | undefined): boolean {
    if (!requestId) {
      return false;
    }
    return !this._activeRequests.has(requestId);
  }

  complete(requestId: string | undefined): void {
    if (requestId) {
      this._activeRequests.delete(requestId);
    }
  }
}
