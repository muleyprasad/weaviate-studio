import { matchTenantNames, wildcardToRegExp, buildTenantMatcher } from '../tenantMatch';

describe('wildcardToRegExp', () => {
  it('anchors the pattern (full-name match)', () => {
    const re = wildcardToRegExp('acme');
    expect(re.test('acme')).toBe(true);
    expect(re.test('acme-corp')).toBe(false);
  });

  it('translates * to any run of characters', () => {
    const re = wildcardToRegExp('*acme*');
    expect(re.test('acme')).toBe(true);
    expect(re.test('the-acme-corp')).toBe(true);
    expect(re.test('nope')).toBe(false);
  });

  it('translates ? to a single character', () => {
    const re = wildcardToRegExp('tenant-?');
    expect(re.test('tenant-1')).toBe(true);
    expect(re.test('tenant-42')).toBe(false);
  });

  it('escapes regex metacharacters in the literal parts', () => {
    const re = wildcardToRegExp('a.b+c');
    expect(re.test('a.b+c')).toBe(true);
    expect(re.test('axbxc')).toBe(false);
  });
});

describe('matchTenantNames', () => {
  const names = ['acme', 'acme-corp', 'globex', 'tenant-1', 'tenant-2', 'TENANT-3'];

  it('returns [] for an empty pattern', () => {
    expect(matchTenantNames(names, '', 'wildcard')).toEqual([]);
    expect(matchTenantNames(names, '   ', 'regex')).toEqual([]);
  });

  it('matches by wildcard contains', () => {
    expect(matchTenantNames(names, '*acme*', 'wildcard')).toEqual(['acme', 'acme-corp']);
  });

  it('matches by wildcard prefix', () => {
    expect(matchTenantNames(names, 'tenant-*', 'wildcard')).toEqual(['tenant-1', 'tenant-2']);
  });

  it('wildcard is a full-name match, not substring by default', () => {
    expect(matchTenantNames(names, 'acme', 'wildcard')).toEqual(['acme']);
  });

  it('matches by regex substring (unanchored)', () => {
    expect(matchTenantNames(names, 'acme', 'regex')).toEqual(['acme', 'acme-corp']);
  });

  it('supports anchored regex', () => {
    expect(matchTenantNames(names, '^tenant-\\d$', 'regex')).toEqual(['tenant-1', 'tenant-2']);
  });

  it('is case-sensitive by default', () => {
    expect(matchTenantNames(names, 'tenant-3', 'regex')).toEqual([]);
    expect(matchTenantNames(names, 'TENANT-3', 'regex')).toEqual(['TENANT-3']);
  });

  it('preserves input order', () => {
    expect(matchTenantNames(names, '*', 'wildcard')).toEqual(names);
  });

  it('throws on invalid regex (caller surfaces the error)', () => {
    expect(() => matchTenantNames(names, '(', 'regex')).toThrow();
  });
});

describe('buildTenantMatcher', () => {
  it('builds a wildcard matcher', () => {
    expect(buildTenantMatcher('t*', 'wildcard').test('tenant')).toBe(true);
  });
  it('builds a regex matcher', () => {
    expect(buildTenantMatcher('ten', 'regex').test('tenant')).toBe(true);
  });
});
