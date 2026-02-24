import * as vscode from 'vscode';
import { ViewRenderer } from '../ViewRenderer';
import type { SchemaProperty } from '../../types';

// Minimal CollectionConfig shape used across tests
function makeSchema(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Article',
    description: 'An article collection',
    properties: [
      { name: 'title', dataType: ['text'], description: 'The title' },
      { name: 'body', dataType: ['text'] },
    ],
    vectorizers: [],
    ...overrides,
  } as any;
}

describe('ViewRenderer', () => {
  let mockContext: vscode.ExtensionContext;
  let renderer: ViewRenderer;

  beforeEach(() => {
    // Reset singleton so each test gets a fresh instance
    (ViewRenderer as any).instance = undefined;

    mockContext = { extensionUri: { fsPath: '/mock/ext' } } as any;
    renderer = ViewRenderer.getInstance(mockContext);
  });

  // ─── Singleton ─────────────────────────────────────────────────────────────

  describe('getInstance', () => {
    it('returns the same instance on repeated calls', () => {
      const a = ViewRenderer.getInstance(mockContext);
      const b = ViewRenderer.getInstance(mockContext);
      expect(a).toBe(b);
    });
  });

  // ─── renderPropertyDetails ──────────────────────────────────────────────────

  describe('renderPropertyDetails', () => {
    const property: SchemaProperty = {
      name: 'title',
      dataType: ['text'],
      description: 'A short title',
      indexInverted: true,
    };

    it('returns a valid HTML document', () => {
      const html = renderer.renderPropertyDetails('title', property, 'Article');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('</html>');
    });

    it('includes property name and collection name', () => {
      const html = renderer.renderPropertyDetails('title', property, 'Article');
      expect(html).toContain('title');
      expect(html).toContain('Article');
    });

    it('escapes HTML special chars in propertyName', () => {
      const html = renderer.renderPropertyDetails('<script>', property, 'Col');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes HTML special chars in collectionName', () => {
      const html = renderer.renderPropertyDetails('prop', property, '<b>Bold</b>');
      expect(html).not.toContain('<b>');
      expect(html).toContain('&lt;b&gt;');
    });

    it('includes dataType in output', () => {
      const html = renderer.renderPropertyDetails('title', property, 'Article');
      expect(html).toContain('text');
    });

    it('shows description when present', () => {
      const html = renderer.renderPropertyDetails('title', property, 'Article');
      expect(html).toContain('A short title');
    });

    it('does not show description section when absent', () => {
      const propNoDesc: SchemaProperty = { name: 'body', dataType: ['text'] };
      const html = renderer.renderPropertyDetails('body', propNoDesc, 'Article');
      // No description label expected in the details section for missing description
      expect(html).not.toContain('A short title');
    });

    it('shows Indexed: Yes when indexInverted is true', () => {
      const html = renderer.renderPropertyDetails(
        'title',
        { ...property, indexInverted: true },
        'Article'
      );
      expect(html).toContain('Yes');
    });

    it('shows Indexed: No when indexInverted is false', () => {
      const html = renderer.renderPropertyDetails(
        'title',
        { ...property, indexInverted: false },
        'Article'
      );
      expect(html).toContain('No');
    });

    it('shows Indexed: Yes when indexInverted is undefined (default)', () => {
      const propNoIndex: SchemaProperty = { name: 'x', dataType: ['text'] };
      const html = renderer.renderPropertyDetails('x', propNoIndex, 'Col');
      expect(html).toContain('Yes');
    });

    it('shows moduleConfig section when present', () => {
      const propWithModule: SchemaProperty = {
        name: 'vec',
        dataType: ['text'],
        moduleConfig: { 'text2vec-openai': { model: 'ada' } },
      };
      const html = renderer.renderPropertyDetails('vec', propWithModule, 'Article');
      expect(html).toContain('Module Configuration');
    });

    it('does not show moduleConfig section when absent', () => {
      const html = renderer.renderPropertyDetails('title', property, 'Article');
      expect(html).not.toContain('Module Configuration');
    });

    it('handles missing dataType gracefully', () => {
      const propNoDT = { name: 'notype', dataType: undefined as any };
      const html = renderer.renderPropertyDetails('notype', propNoDT, 'Col');
      expect(html).toContain('Unknown');
    });
  });

  // ─── renderDetailedSchema ───────────────────────────────────────────────────

  describe('renderDetailedSchema', () => {
    it('returns a valid HTML document', () => {
      const html = renderer.renderDetailedSchema(makeSchema());
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('includes the collection name in the title', () => {
      const html = renderer.renderDetailedSchema(makeSchema({ name: 'MyCollection' }));
      expect(html).toContain('MyCollection');
    });

    it('renders property names', () => {
      const html = renderer.renderDetailedSchema(makeSchema());
      expect(html).toContain('title');
      expect(html).toContain('body');
    });

    it('shows "No properties found" when properties are empty', () => {
      const html = renderer.renderDetailedSchema(makeSchema({ properties: [] }));
      expect(html).toContain('No properties found');
    });

    it('shows "No properties found" when properties are undefined', () => {
      const html = renderer.renderDetailedSchema(makeSchema({ properties: undefined }));
      expect(html).toContain('No properties found');
    });

    it('includes property description when present', () => {
      const html = renderer.renderDetailedSchema(makeSchema());
      expect(html).toContain('The title');
    });

    it('includes Sharding section when sharding config present', () => {
      const html = renderer.renderDetailedSchema(
        makeSchema({ sharding: { virtualPerPhysical: 128 } })
      );
      expect(html).toContain('Sharding');
    });

    it('includes Replication section when replication config present', () => {
      const html = renderer.renderDetailedSchema(makeSchema({ replication: { factor: 3 } }));
      expect(html).toContain('Replication');
    });

    it('includes Multi-Tenancy section when multiTenancy config present', () => {
      const html = renderer.renderDetailedSchema(makeSchema({ multiTenancy: { enabled: true } }));
      expect(html).toContain('Multi-Tenancy');
    });

    it('omits Scaling Configuration when none present', () => {
      const html = renderer.renderDetailedSchema(makeSchema());
      expect(html).not.toContain('Scaling Configuration');
    });

    it('escapes XSS in collection name inside h1 and title', () => {
      const html = renderer.renderDetailedSchema(makeSchema({ name: '<b>Bold</b>' }));
      // The h1 and title both use escapeHtml
      expect(html).toContain('&lt;b&gt;Bold&lt;/b&gt;');
    });

    it('includes restApiJson in output when provided', () => {
      const html = renderer.renderDetailedSchema(makeSchema(), { someKey: 'someValue' });
      expect(html).toContain('someValue');
    });

    it('handles schema with array dataType on property', () => {
      const schema = makeSchema({
        properties: [{ name: 'ref', dataType: ['Article', 'Author'] }],
      });
      const html = renderer.renderDetailedSchema(schema);
      expect(html).toContain('Article');
    });
  });

  // ─── renderRawConfig ────────────────────────────────────────────────────────

  describe('renderRawConfig', () => {
    it('returns a valid HTML document', () => {
      const html = renderer.renderRawConfig(makeSchema(), 'conn-1');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
    });

    it('includes the collection name', () => {
      const html = renderer.renderRawConfig(makeSchema({ name: 'Products' }), 'conn-1');
      expect(html).toContain('Products');
    });

    it('includes the serialized schema JSON (HTML-escaped)', () => {
      const schema = makeSchema({ name: 'Items' });
      const html = renderer.renderRawConfig(schema, 'conn-1');
      // JSON keys are HTML-escaped in the pre block
      expect(html).toContain('&quot;name&quot;');
    });

    it('escapes XSS in collection name via escapeHtml', () => {
      const html = renderer.renderRawConfig(
        makeSchema({ name: '<script>alert(1)</script>' }),
        'conn-1'
      );
      // Raw unescaped string must not appear; the escaped form must appear instead
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
