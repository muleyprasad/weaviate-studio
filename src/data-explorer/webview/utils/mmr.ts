/**
 * MMR diversity selection helpers (Weaviate >= 1.39, near-* queries)
 */

type MmrLimitSource = {
  /** Number of results the query asks for. */
  limit: number;
  /** Candidate pool for MMR, when the caller set one explicitly. */
  mmrLimit?: number;
};

/**
 * Candidate pool size for MMR.
 *
 * The server rejects a diversity block without a limit and requires
 * 1 <= limit <= the query limit, so default to the result count and clamp any
 * explicit value into that range.
 */
export function mmrCandidateLimit(params: MmrLimitSource): number {
  return Math.min(params.limit, Math.max(1, params.mmrLimit ?? params.limit));
}
