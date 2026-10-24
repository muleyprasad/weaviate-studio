import {
  parseImportPayload,
  parseJsonImport,
  parseCsvImport,
  coerceCsvValue,
} from '../importUtils';

describe('importUtils - JSON parsing', () => {
  test('parses an array of objects', () => {
    const { objects, warnings } = parseJsonImport(
      JSON.stringify([{ title: 'A' }, { title: 'B', count: 2 }])
    );
    expect(objects).toHaveLength(2);
    expect(objects[0].properties).toEqual({ title: 'A' });
    expect(objects[1].properties).toEqual({ title: 'B', count: 2 });
    expect(warnings).toHaveLength(0);
  });

  test('parses a single object', () => {
    const { objects } = parseJsonImport(JSON.stringify({ title: 'Solo' }));
    expect(objects).toHaveLength(1);
    expect(objects[0].properties).toEqual({ title: 'Solo' });
  });

  test('parses an { objects: [...] } wrapper', () => {
    const { objects } = parseJsonImport(JSON.stringify({ objects: [{ title: 'W' }] }));
    expect(objects).toHaveLength(1);
  });

  test('extracts id and vector out of properties', () => {
    const { objects } = parseJsonImport(
      JSON.stringify([{ id: 'abc-123', title: 'V', vector: [0.1, 0.2] }])
    );
    expect(objects[0].id).toBe('abc-123');
    expect(objects[0].vector).toEqual([0.1, 0.2]);
    expect(objects[0].properties).toEqual({ title: 'V' });
  });

  test('supports _id and uuid aliases', () => {
    const { objects } = parseJsonImport(JSON.stringify([{ _id: 'x' }, { uuid: 'y', a: 1 }]));
    expect(objects[0].id).toBe('x');
    expect(objects[1].id).toBe('y');
  });

  test('skips non-object items with warnings', () => {
    const { objects, warnings } = parseJsonImport(JSON.stringify([{ ok: true }, 42, 'nope']));
    expect(objects).toHaveLength(1);
    expect(warnings.length).toBeGreaterThan(0);
  });

  test('rejects invalid JSON', () => {
    expect(() => parseJsonImport('{oops')).toThrow('Invalid JSON');
  });

  test('rejects empty arrays and scalars', () => {
    expect(() => parseJsonImport('[]')).toThrow('no objects');
    expect(() => parseJsonImport('42')).toThrow('Invalid JSON');
  });
});

describe('importUtils - CSV parsing', () => {
  test('parses header + rows', () => {
    const { objects } = parseCsvImport('title,count\nHello,3\nWorld,4');
    expect(objects).toHaveLength(2);
    expect(objects[0].properties).toEqual({ title: 'Hello', count: 3 });
  });

  test('handles quotes, commas, and embedded newlines', () => {
    const { objects } = parseCsvImport(
      'title,notes\n"Hello, there","line 1\nline 2"\nPlain,Simple'
    );
    expect(objects).toHaveLength(2);
    expect(objects[0].properties).toEqual({ title: 'Hello, there', notes: 'line 1\nline 2' });
  });

  test('handles escaped quotes', () => {
    const { objects } = parseCsvImport('title\n"Say ""hi"""');
    expect(objects[0].properties).toEqual({ title: 'Say "hi"' });
  });

  test('skips blank lines', () => {
    const { objects } = parseCsvImport('title\nA\n\nB\n');
    expect(objects).toHaveLength(2);
  });

  test('omits empty cells', () => {
    const { objects } = parseCsvImport('title,count\nA,\n,5');
    expect(objects[0].properties).toEqual({ title: 'A' });
    expect(objects[1].properties).toEqual({ count: 5 });
  });

  test('maps an id column to the object id', () => {
    const { objects } = parseCsvImport('id,title\nabc,Hello');
    expect(objects[0].id).toBe('abc');
    expect(objects[0].properties).toEqual({ title: 'Hello' });
  });

  test('rejects headerless content', () => {
    expect(() => parseCsvImport('')).toThrow('no rows');
    expect(() => parseCsvImport('\n\n')).toThrow('no rows');
  });
});

describe('importUtils - value coercion', () => {
  test.each([
    ['42', 42],
    ['-7', -7],
    ['3.14', 3.14],
    ['true', true],
    ['FALSE', false],
    ['hello', 'hello'],
    ['0123', '0123'],
  ])('coerces %p to %p', (raw, expected) => {
    expect(coerceCsvValue(raw)).toBe(expected);
  });

  test('empty becomes undefined', () => {
    expect(coerceCsvValue('')).toBeUndefined();
    expect(coerceCsvValue('   ')).toBeUndefined();
  });
});

describe('importUtils - dispatcher', () => {
  test('rejects empty payloads', () => {
    expect(() => parseImportPayload('  ', 'json')).toThrow('empty');
  });

  test('rejects oversize payloads', () => {
    expect(() => parseImportPayload('x'.repeat(10 * 1024 * 1024 + 1), 'json')).toThrow('10 MB');
  });

  test('routes by format', () => {
    expect(parseImportPayload('[{"a":1}]', 'json').objects).toHaveLength(1);
    expect(parseImportPayload('a\n1', 'csv').objects).toHaveLength(1);
  });
});
