/**
 * Tenant-name matching for bulk tenant operations.
 *
 * Users can target tenants either by explicit selection or by a pattern:
 *  - `wildcard` — glob-style, where `*` matches any run of characters and `?`
 *    matches a single character. The pattern is anchored (full-name match), so
 *    `*_2024` matches names ending in `_2024` and `*acme*` matches names that
 *    contain `acme`.
 *  - `regex` — a JavaScript regular expression, tested unanchored so a bare
 *    `acme` matches any name containing it. Use `^`/`$` for exact matches.
 */

export type TenantMatchMode = 'wildcard' | 'regex';

/**
 * Upper bound on pattern length. Matching runs synchronously on the webview
 * thread against every tenant name, so an over-long user-authored `regex`
 * pattern (e.g. a nested-quantifier ReDoS like `(a+)+$`) could otherwise stall
 * the UI. Tenant names are short and server-bounded, so a modest cap on the
 * pattern side keeps worst-case backtracking well contained without needing a
 * linear-time engine.
 */
export const MAX_PATTERN_LENGTH = 200;

/**
 * Converts a glob-style wildcard pattern into an anchored RegExp.
 *
 * All regex metacharacters are escaped except `*` and `?`, which are translated
 * to `.*` and `.` respectively. The result is anchored with `^…$` so the whole
 * tenant name must match.
 *
 * Consecutive `*` are collapsed to a single `*` first: `**acme**` and `*acme*`
 * are equivalent globs, but the naive translation would emit adjacent `.*.*`
 * groups that multiply backtracking work for no added matching power.
 */
export function wildcardToRegExp(pattern: string): RegExp {
  // Collapse runs of `*` — `.*.*` matches exactly what `.*` does, only slower.
  const collapsed = pattern.replace(/\*+/g, '*');
  // Escape every regex special char except * and ? (handled below).
  const escaped = collapsed.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const converted = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${converted}$`);
}

/**
 * Builds the matcher RegExp for a pattern + mode.
 *
 * @throws {RangeError} if the pattern exceeds {@link MAX_PATTERN_LENGTH}.
 * @throws {SyntaxError} if `mode` is `regex` and the pattern is not a valid regex.
 */
export function buildTenantMatcher(pattern: string, mode: TenantMatchMode): RegExp {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new RangeError(`Pattern is too long (max ${MAX_PATTERN_LENGTH} characters).`);
  }
  return mode === 'wildcard' ? wildcardToRegExp(pattern) : new RegExp(pattern);
}

/**
 * Returns the subset of `names` that match `pattern` under the given `mode`.
 *
 * An empty/blank pattern matches nothing (returns `[]`) so an empty input never
 * accidentally selects every tenant. Order of the input is preserved.
 *
 * @throws {RangeError} if the pattern exceeds {@link MAX_PATTERN_LENGTH}.
 * @throws {SyntaxError} if `mode` is `regex` and the pattern is invalid — callers
 *         should catch these to surface a friendly message.
 */
export function matchTenantNames(
  names: string[],
  pattern: string,
  mode: TenantMatchMode
): string[] {
  if (!pattern || pattern.trim() === '') {
    return [];
  }
  const matcher = buildTenantMatcher(pattern, mode);
  return names.filter((name) => matcher.test(name));
}
