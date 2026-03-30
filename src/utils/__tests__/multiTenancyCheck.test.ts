import {
  computeCollectionHash,
  computeCandidatesDismissKey,
  findMultiTenantCandidates,
  MtCandidateGroup,
  PropertyLike,
} from '../multiTenancyCheck';
import { CollectionWithSchema } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCollection(
  name: string,
  properties: PropertyLike[] = [],
  multiTenancyEnabled = false
): CollectionWithSchema {
  return {
    label: name,
    collapsibleState: 0,
    itemType: 'collection',
    schema: {
      name,
      properties: properties as any,
      multiTenancy: { enabled: multiTenancyEnabled } as any,
    } as any,
  } as unknown as CollectionWithSchema;
}

function groupNames(group: MtCandidateGroup): string[] {
  return group.collections.map((c) => c.name);
}

// ─── computeCollectionHash ────────────────────────────────────────────────────

describe('computeCollectionHash', () => {
  it('returns empty string for empty property list', () => {
    expect(computeCollectionHash([])).toBe('');
  });

  it('returns empty string for null/undefined input', () => {
    expect(computeCollectionHash(null as any)).toBe('');
    expect(computeCollectionHash(undefined as any)).toBe('');
  });

  it('produces a non-empty fingerprint for a single property', () => {
    const props: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: 'word' }];
    expect(computeCollectionHash(props)).toBe('title|word|text');
  });

  it('sorts properties alphabetically so declaration order does not matter (scenario 5)', () => {
    const propsA: PropertyLike[] = [
      { name: 'title', dataType: ['text'], tokenization: 'word' },
      { name: 'age', dataType: ['int'] },
    ];
    const propsB: PropertyLike[] = [
      { name: 'age', dataType: ['int'] },
      { name: 'title', dataType: ['text'], tokenization: 'word' },
    ];
    expect(computeCollectionHash(propsA)).toBe(computeCollectionHash(propsB));
  });

  it('treats null tokenization as "word" (scenario 11)', () => {
    const withNull: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: null }];
    const withWord: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: 'word' }];
    expect(computeCollectionHash(withNull)).toBe(computeCollectionHash(withWord));
  });

  it('treats undefined tokenization as "word" (scenario 11)', () => {
    const withUndefined: PropertyLike[] = [{ name: 'title', dataType: ['text'] }];
    const withWord: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: 'word' }];
    expect(computeCollectionHash(withUndefined)).toBe(computeCollectionHash(withWord));
  });

  it('treats empty string tokenization as "word" (scenario 12)', () => {
    const withEmpty: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: '' }];
    const withWord: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: 'word' }];
    expect(computeCollectionHash(withEmpty)).toBe(computeCollectionHash(withWord));
  });

  it('treats whitespace-only tokenization as "word"', () => {
    const withSpace: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: '   ' }];
    const withWord: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: 'word' }];
    expect(computeCollectionHash(withSpace)).toBe(computeCollectionHash(withWord));
  });

  it('produces different hashes for different tokenizations (scenario 7)', () => {
    const field: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: 'field' }];
    const word: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: 'word' }];
    expect(computeCollectionHash(field)).not.toBe(computeCollectionHash(word));
  });

  it('produces different hashes for different dataTypes (scenario 6)', () => {
    const text: PropertyLike[] = [{ name: 'value', dataType: ['text'] }];
    const int: PropertyLike[] = [{ name: 'value', dataType: ['int'] }];
    expect(computeCollectionHash(text)).not.toBe(computeCollectionHash(int));
  });

  it('sorts multi-value dataType arrays for consistent ordering (scenario 13)', () => {
    const propsA: PropertyLike[] = [{ name: 'ref', dataType: ['int', 'text'] }];
    const propsB: PropertyLike[] = [{ name: 'ref', dataType: ['text', 'int'] }];
    expect(computeCollectionHash(propsA)).toBe(computeCollectionHash(propsB));
  });

  it('handles string dataType (non-array) without throwing', () => {
    const props: PropertyLike[] = [{ name: 'title', dataType: 'text' as any }];
    expect(() => computeCollectionHash(props)).not.toThrow();
    expect(computeCollectionHash(props)).toBe('title|word|text');
  });

  it('handles property with no dataType', () => {
    const props: PropertyLike[] = [{ name: 'title' }];
    expect(() => computeCollectionHash(props)).not.toThrow();
    expect(computeCollectionHash(props)).toBe('title|word|');
  });

  // ── Nested / object properties ──────────────────────────────────────────────

  it('includes nested properties in fingerprint for object type (scenario 14)', () => {
    const props: PropertyLike[] = [
      {
        name: 'meta',
        dataType: ['object'],
        nestedProperties: [
          { name: 'author', dataType: ['text'] },
          { name: 'year', dataType: ['int'] },
        ],
      },
    ];
    expect(computeCollectionHash(props)).toBe('meta|word|object{author|word|text;year|word|int}');
  });

  it('sorts nested properties alphabetically (scenario 14)', () => {
    const propsA: PropertyLike[] = [
      {
        name: 'meta',
        dataType: ['object'],
        nestedProperties: [
          { name: 'year', dataType: ['int'] },
          { name: 'author', dataType: ['text'] },
        ],
      },
    ];
    const propsB: PropertyLike[] = [
      {
        name: 'meta',
        dataType: ['object'],
        nestedProperties: [
          { name: 'author', dataType: ['text'] },
          { name: 'year', dataType: ['int'] },
        ],
      },
    ];
    expect(computeCollectionHash(propsA)).toBe(computeCollectionHash(propsB));
  });

  it('produces different hashes for different nested property names (scenario 15)', () => {
    const propsA: PropertyLike[] = [
      {
        name: 'meta',
        dataType: ['object'],
        nestedProperties: [{ name: 'author', dataType: ['text'] }],
      },
    ];
    const propsB: PropertyLike[] = [
      {
        name: 'meta',
        dataType: ['object'],
        nestedProperties: [{ name: 'writer', dataType: ['text'] }],
      },
    ];
    expect(computeCollectionHash(propsA)).not.toBe(computeCollectionHash(propsB));
  });

  it('produces different hashes for different nested tokenizations (scenario 16)', () => {
    const propsA: PropertyLike[] = [
      {
        name: 'meta',
        dataType: ['object'],
        nestedProperties: [{ name: 'tag', dataType: ['text'], tokenization: 'word' }],
      },
    ];
    const propsB: PropertyLike[] = [
      {
        name: 'meta',
        dataType: ['object'],
        nestedProperties: [{ name: 'tag', dataType: ['text'], tokenization: 'field' }],
      },
    ];
    expect(computeCollectionHash(propsA)).not.toBe(computeCollectionHash(propsB));
  });

  it('handles 3-level deep nesting consistently (scenario 17)', () => {
    const deep: PropertyLike[] = [
      {
        name: 'level1',
        dataType: ['object'],
        nestedProperties: [
          {
            name: 'level2',
            dataType: ['object'],
            nestedProperties: [{ name: 'level3', dataType: ['text'] }],
          },
        ],
      },
    ];
    const deepCopy: PropertyLike[] = [
      {
        name: 'level1',
        dataType: ['object'],
        nestedProperties: [
          {
            name: 'level2',
            dataType: ['object'],
            nestedProperties: [{ name: 'level3', dataType: ['text'] }],
          },
        ],
      },
    ];
    expect(computeCollectionHash(deep)).toBe(computeCollectionHash(deepCopy));
    expect(computeCollectionHash(deep)).toBe(
      'level1|word|object{level2|word|object{level3|word|text}}'
    );
  });

  it('object type with no nestedProperties produces no nested segment (scenario 18)', () => {
    const propsA: PropertyLike[] = [{ name: 'meta', dataType: ['object'] }];
    const propsB: PropertyLike[] = [{ name: 'meta', dataType: ['object'], nestedProperties: [] }];
    expect(computeCollectionHash(propsA)).toBe(computeCollectionHash(propsB));
    expect(computeCollectionHash(propsA)).toBe('meta|word|object');
  });

  it('multi-type property including object sorts types and appends nested (scenario 19)', () => {
    const props: PropertyLike[] = [
      {
        name: 'ref',
        dataType: ['text', 'object'],
        nestedProperties: [{ name: 'id', dataType: ['int'] }],
      },
    ];
    expect(computeCollectionHash(props)).toBe('ref|word|object+text{id|word|int}');
  });
});

// ─── findMultiTenantCandidates ─────────────────────────────────────────────────

describe('findMultiTenantCandidates', () => {
  it('returns empty array for empty collection list (scenario 1)', () => {
    expect(findMultiTenantCandidates([])).toHaveLength(0);
  });

  it('returns empty array for a single collection (scenario 2)', () => {
    const cols = [makeCollection('A', [{ name: 'title', dataType: ['text'] }])];
    expect(findMultiTenantCandidates(cols)).toHaveLength(0);
  });

  it('groups two collections with identical flat properties (scenario 3)', () => {
    const props: PropertyLike[] = [{ name: 'title', dataType: ['text'], tokenization: 'word' }];
    const cols = [makeCollection('ColA', props), makeCollection('ColB', props)];
    const result = findMultiTenantCandidates(cols);
    expect(result).toHaveLength(1);
    expect(groupNames(result[0])).toEqual(expect.arrayContaining(['ColA', 'ColB']));
    expect(result[0].count).toBe(2);
  });

  it('groups two matching collections and excludes the different one (scenario 4)', () => {
    const sharedProps: PropertyLike[] = [{ name: 'title', dataType: ['text'] }];
    const uniqueProps: PropertyLike[] = [{ name: 'score', dataType: ['int'] }];
    const cols = [
      makeCollection('ColA', sharedProps),
      makeCollection('ColB', sharedProps),
      makeCollection('ColC', uniqueProps),
    ];
    const result = findMultiTenantCandidates(cols);
    expect(result).toHaveLength(1);
    expect(groupNames(result[0])).toEqual(expect.arrayContaining(['ColA', 'ColB']));
    expect(groupNames(result[0])).not.toContain('ColC');
  });

  it('excludes collections with multiTenancy already enabled (scenario 9)', () => {
    const props: PropertyLike[] = [{ name: 'title', dataType: ['text'] }];
    const cols = [
      makeCollection('ColA', props, false),
      makeCollection('ColB', props, true), // already MT
    ];
    expect(findMultiTenantCandidates(cols)).toHaveLength(0);
  });

  it('does not group when only one non-MT collection remains after exclusion (scenario 10)', () => {
    const props: PropertyLike[] = [{ name: 'title', dataType: ['text'] }];
    const cols = [
      makeCollection('ColA', props, false),
      makeCollection('ColB', props, true), // excluded
      makeCollection('ColC', props, true), // excluded
    ];
    expect(findMultiTenantCandidates(cols)).toHaveLength(0);
  });

  it('groups all no-property collections together (scenario 8)', () => {
    const cols = [
      makeCollection('Empty1', []),
      makeCollection('Empty2', []),
      makeCollection('Empty3', []),
    ];
    const result = findMultiTenantCandidates(cols);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
  });

  it('does not group collections with different schemas', () => {
    const cols = [
      makeCollection('ColA', [{ name: 'title', dataType: ['text'] }]),
      makeCollection('ColB', [{ name: 'score', dataType: ['int'] }]),
    ];
    expect(findMultiTenantCandidates(cols)).toHaveLength(0);
  });

  it('returns multiple independent candidate groups', () => {
    const propsGroup1: PropertyLike[] = [{ name: 'title', dataType: ['text'] }];
    const propsGroup2: PropertyLike[] = [{ name: 'score', dataType: ['int'] }];
    const cols = [
      makeCollection('A1', propsGroup1),
      makeCollection('A2', propsGroup1),
      makeCollection('B1', propsGroup2),
      makeCollection('B2', propsGroup2),
    ];
    const result = findMultiTenantCandidates(cols);
    expect(result).toHaveLength(2);
  });

  // ── Object count integration ────────────────────────────────────────────────

  it('uses objectCounts to populate entry counts, defaulting to 0', () => {
    const props: PropertyLike[] = [{ name: 'title', dataType: ['text'] }];
    const cols = [makeCollection('ColA', props), makeCollection('ColB', props)];
    const result = findMultiTenantCandidates(cols, { ColA: 500, ColB: 200 });
    expect(result[0].collections.find((c) => c.name === 'ColA')?.objectCount).toBe(500);
    expect(result[0].collections.find((c) => c.name === 'ColB')?.objectCount).toBe(200);
  });

  it('defaults objectCount to 0 when not in objectCounts map', () => {
    const props: PropertyLike[] = [{ name: 'title', dataType: ['text'] }];
    const cols = [makeCollection('ColA', props), makeCollection('ColB', props)];
    const result = findMultiTenantCandidates(cols, {});
    expect(result[0].collections[0].objectCount).toBe(0);
    expect(result[0].collections[1].objectCount).toBe(0);
  });

  it('sorts collections within a group by objectCount descending', () => {
    const props: PropertyLike[] = [{ name: 'title', dataType: ['text'] }];
    const cols = [
      makeCollection('Small', props),
      makeCollection('Large', props),
      makeCollection('Medium', props),
    ];
    const result = findMultiTenantCandidates(cols, { Small: 10, Large: 1000, Medium: 300 });
    const names = groupNames(result[0]);
    expect(names[0]).toBe('Large');
    expect(names[1]).toBe('Medium');
    expect(names[2]).toBe('Small');
  });

  it('computes totalObjects correctly', () => {
    const props: PropertyLike[] = [{ name: 'title', dataType: ['text'] }];
    const cols = [makeCollection('ColA', props), makeCollection('ColB', props)];
    const result = findMultiTenantCandidates(cols, { ColA: 400, ColB: 100 });
    expect(result[0].totalObjects).toBe(500);
  });

  it('sorts groups by totalObjects descending so highest-impact group is first', () => {
    const propsG1: PropertyLike[] = [{ name: 'x', dataType: ['text'] }];
    const propsG2: PropertyLike[] = [{ name: 'y', dataType: ['int'] }];
    const cols = [
      makeCollection('G1A', propsG1),
      makeCollection('G1B', propsG1),
      makeCollection('G2A', propsG2),
      makeCollection('G2B', propsG2),
    ];
    // Group 2 has more total objects
    const result = findMultiTenantCandidates(cols, { G1A: 100, G1B: 50, G2A: 2000, G2B: 1000 });
    expect(result[0].totalObjects).toBe(3000); // G2 group first
    expect(result[1].totalObjects).toBe(150); // G1 group second
    expect(groupNames(result[0])).toEqual(expect.arrayContaining(['G2A', 'G2B']));
  });

  it('works correctly without objectCounts parameter (all zeros, stable sort)', () => {
    const props: PropertyLike[] = [{ name: 'title', dataType: ['text'] }];
    const cols = [makeCollection('ColA', props), makeCollection('ColB', props)];
    const result = findMultiTenantCandidates(cols);
    expect(result).toHaveLength(1);
    expect(result[0].totalObjects).toBe(0);
    expect(result[0].collections.every((c) => c.objectCount === 0)).toBe(true);
  });
});

// ─── computeCandidatesDismissKey ──────────────────────────────────────────────

describe('computeCandidatesDismissKey', () => {
  it('returns empty string for empty groups array', () => {
    expect(computeCandidatesDismissKey([])).toBe('');
  });

  it('returns sorted collection names joined by comma', () => {
    const groups: MtCandidateGroup[] = [
      {
        collections: [
          { name: 'ColB', objectCount: 0 },
          { name: 'ColA', objectCount: 0 },
        ],
        count: 2,
        totalObjects: 0,
      },
    ];
    expect(computeCandidatesDismissKey(groups)).toBe('ColA,ColB');
  });

  it('flattens and sorts across multiple groups', () => {
    const groups: MtCandidateGroup[] = [
      {
        collections: [
          { name: 'ColD', objectCount: 0 },
          { name: 'ColA', objectCount: 0 },
        ],
        count: 2,
        totalObjects: 0,
      },
      {
        collections: [
          { name: 'ColC', objectCount: 0 },
          { name: 'ColB', objectCount: 0 },
        ],
        count: 2,
        totalObjects: 0,
      },
    ];
    expect(computeCandidatesDismissKey(groups)).toBe('ColA,ColB,ColC,ColD');
  });

  it('produces different keys when collections change', () => {
    const before: MtCandidateGroup[] = [
      {
        collections: [
          { name: 'ColA', objectCount: 0 },
          { name: 'ColB', objectCount: 0 },
        ],
        count: 2,
        totalObjects: 0,
      },
    ];
    const after: MtCandidateGroup[] = [
      {
        collections: [
          { name: 'ColA', objectCount: 0 },
          { name: 'ColB', objectCount: 0 },
          { name: 'ColC', objectCount: 0 },
        ],
        count: 3,
        totalObjects: 0,
      },
    ];
    expect(computeCandidatesDismissKey(before)).not.toBe(computeCandidatesDismissKey(after));
  });
});
