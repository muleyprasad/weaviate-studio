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

// ─── Merge logic (extracted from RagChatPanel._handleExecuteRagQuery) ─────────

export type SettledQueryResult = {
  collectionName: string;
  answer: string;
  contextObjects: Array<{
    uuid: string;
    properties: Record<string, unknown>;
    distance?: number;
    certainty?: number;
    score?: number;
  }>;
};

/**
 * Merges the results of Promise.allSettled across multiple RAG collection queries.
 * Failed queries produce a warning answer and empty context objects.
 * Pure function — no side effects, easy to unit-test.
 */
export function mergeSettledResults(
  settled: PromiseSettledResult<SettledQueryResult>[],
  collectionNames: string[]
): {
  answer: string;
  contextObjects: Array<SettledQueryResult['contextObjects'][number] & { collectionName: string }>;
  allFailed: boolean;
} {
  const allFailed = settled.length > 0 && settled.every((o) => o.status === 'rejected');

  const results: SettledQueryResult[] = settled.map((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value;
    }
    const errMsg =
      outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
    console.warn(`RagChatPanel: Query failed for collection "${collectionNames[i]}": ${errMsg}`);
    return {
      collectionName: collectionNames[i],
      answer: `⚠️ Query failed for "${collectionNames[i]}": ${errMsg}`,
      contextObjects: [],
    };
  });

  const contextObjects = results.flatMap((r) =>
    r.contextObjects.map((obj) => ({ ...obj, collectionName: r.collectionName }))
  );

  const answer =
    results.length === 1
      ? results[0].answer
      : results.map((r) => `### From ${r.collectionName}\n\n${r.answer}`).join('\n\n---\n\n');

  return { answer, contextObjects, allFailed };
}

// ─── Input validation (extracted from RagChatPanel._handleExecuteRagQuery) ────

export type RagQueryValidationError = 'no_collections' | 'empty_question';

/**
 * Validates the core inputs for a RAG query before execution.
 * Returns the error key if invalid, or null if valid.
 */
export function validateRagQueryInput(
  collectionNames: string[],
  question: string | undefined
): RagQueryValidationError | null {
  if (collectionNames.length === 0) {
    return 'no_collections';
  }
  if (!question?.trim()) {
    return 'empty_question';
  }
  return null;
}

/**
 * Escapes characters that could break out of an inline <script> block when
 * JSON-serialised data is embedded directly in HTML. Covers `<`, `>`, and `&`.
 * This is defence-in-depth: a CSP nonce already blocks injected scripts, but
 * escaping prevents the `</script>` sequence from prematurely closing the tag.
 */
export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
