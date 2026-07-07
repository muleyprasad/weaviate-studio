/**
 * Parser for the tenant object-count filter used in the Manage Tenants panel.
 *
 * Supported syntax (whitespace and case are ignored, `count` is the keyword):
 *  - Comparison:      `count=0`, `count==0`, `count!=0`, `count>1`, `count>=10`,
 *                     `count<50`, `count<=50`
 *  - Reversed:        `0=count`, `5<count`, `50>=count` (number on the left)
 *  - Range:           `10<count<50`, `10<=count<=50`, `50>count>10`
 *
 * Object count comes from node status and is only known for ACTIVE (loaded)
 * tenants; tenants whose count is unknown (`null`) never match a non-empty
 * filter.
 */

/** A predicate over a tenant's object count (`null` = unknown / not loaded). */
export type CountPredicate = (count: number | null) => boolean;

type Op = '=' | '==' | '!=' | '>' | '>=' | '<' | '<=';

/** Evaluates `a <op> b`. */
function compare(op: Op, a: number, b: number): boolean {
  switch (op) {
    case '=':
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    default:
      return false;
  }
}

const NUM = '(-?\\d+(?:\\.\\d+)?)';
// Multi-char operators must precede single-char ones in the alternation.
const OP = '(==|!=|>=|<=|=|>|<)';
const RANGE_OP = '(<=|>=|<|>)';

const RE_COUNT_LEFT = new RegExp(`^count${OP}${NUM}$`);
const RE_NUM_LEFT = new RegExp(`^${NUM}${OP}count$`);
const RE_RANGE = new RegExp(`^${NUM}${RANGE_OP}count${RANGE_OP}${NUM}$`);

/**
 * Parses a count-filter expression into a predicate.
 *
 * An empty/blank expression returns a predicate that matches everything
 * (including unknown counts). Any non-empty expression only matches tenants
 * with a known numeric count.
 *
 * @throws Error with a friendly message when the expression is not valid.
 */
export function parseCountFilter(expr: string): CountPredicate {
  const raw = (expr ?? '').trim();
  if (raw === '') {
    return () => true;
  }

  // Normalize: drop all whitespace, lowercase the `count` keyword.
  const t = raw.replace(/\s+/g, '').toLowerCase();

  const range = t.match(RE_RANGE);
  if (range) {
    const lo = parseFloat(range[1]);
    const loOp = range[2] as Op;
    const hiOp = range[3] as Op;
    const hi = parseFloat(range[4]);
    return (c) => c !== null && compare(loOp, lo, c) && compare(hiOp, c, hi);
  }

  const countLeft = t.match(RE_COUNT_LEFT);
  if (countLeft) {
    const op = countLeft[1] as Op;
    const n = parseFloat(countLeft[2]);
    return (c) => c !== null && compare(op, c, n);
  }

  const numLeft = t.match(RE_NUM_LEFT);
  if (numLeft) {
    const n = parseFloat(numLeft[1]);
    const op = numLeft[2] as Op;
    return (c) => c !== null && compare(op, n, c);
  }

  throw new Error(`Invalid count filter: "${raw}"`);
}
