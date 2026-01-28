import { WeaviateTreeDataProvider } from '../WeaviateTreeDataProvider';
import * as vscode from 'vscode';

// --- Mocks ------------------------------------------------------------

// Mock ConnectionManager with minimal behavior we need
class MockConnectionManager {
  private static instance: MockConnectionManager;
  private connections: any[];
  public onConnectionsChanged = (listener: () => void) => {
    /* no-op for these tests */
  };

  private constructor(connections: any[]) {
    this.connections = connections;
  }

  static getInstance(_ctx: vscode.ExtensionContext, seed?: any[]): MockConnectionManager {
    if (!MockConnectionManager.instance) {
      MockConnectionManager.instance = new MockConnectionManager(seed || []);
    }
    return MockConnectionManager.instance;
  }

  getConnections() {
    return [...this.connections].sort((a: any, b: any) => (b.lastUsed || 0) - (a.lastUsed || 0));
  }

  // additional stubs if needed later
  getConnection(_id: string) {
    return this.connections.find((c) => c.id === _id);
  }
}

// Jest module mocks
jest.mock('../../services/ConnectionManager', () => {
  return {
    ConnectionManager: {
      getInstance: (...args: any[]) => MockConnectionManager.getInstance(args[0], mockConnections),
    },
  };
});

jest.mock('../../views/ViewRenderer', () => {
  return {
    ViewRenderer: {
      getInstance: () => ({
        renderDetailedSchema: jest.fn(),
        renderRawConfig: jest.fn(),
      }),
    },
  };
});

const mockConnections = [
  { id: '1', name: 'Local', url: 'http://a', status: 'disconnected', lastUsed: 1 },
  { id: '2', name: 'Prod', url: 'http://b', status: 'connected', lastUsed: 2 },
];

// ---------------------------------------------------------------------

describe('WeaviateTreeDataProvider', () => {
  let provider: WeaviateTreeDataProvider;
  const mockCtx = {
    globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
    subscriptions: [],
  } as unknown as vscode.ExtensionContext;

  beforeEach(() => {
    // Reset singleton between tests
    jest.resetModules();
    (MockConnectionManager as any).instance = undefined;
    provider = new (require('../WeaviateTreeDataProvider').WeaviateTreeDataProvider)(mockCtx);
  });

  it('returns connection nodes at root', async () => {
    const children = await provider.getChildren();
    expect(children).toHaveLength(mockConnections.length);
    const labels = children.map((c: any) => c.label);
    expect(labels).toContain('🔗 Local');
    expect(labels).toContain('🔗 Prod');
  });

  it('sorts connections by lastUsed desc', async () => {
    const children = await provider.getChildren();
    expect(children[0].label).toBe('🔗 Prod');
    expect(children[1].label).toBe('🔗 Local');
  });

  it('create TreeItem for connection has collapsibleState', async () => {
    const children = await provider.getChildren();
    const item: any = provider.getTreeItem(children[0]);
    expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
  });

  it('getStatusIcon returns correct icon for statuses', () => {
    const iconConnected: any = provider.getStatusIcon('connected');
    const iconDisconnected: any = provider.getStatusIcon('disconnected');
    const iconConnecting: any = provider.getStatusIcon('connecting');
    expect(iconConnected.id).toBe('circle-filled');
    expect(iconConnected.color.id).toBe('testing.iconPassed');
    expect(iconConnecting.id).toBe('sync~spin');
    expect(iconDisconnected.id).toBe('circle-outline');
    expect(iconDisconnected.id).toBe('circle-outline');
    expect(iconDisconnected.color).toBeUndefined();
  });

  it('child nodes under a connected connection include expected sections', async () => {
    const rootChildren = await provider.getChildren();
    const connected: any = rootChildren.find((c: any) => c.label.endsWith('Prod'));
    expect(connected).toBeDefined();
    const sections = await provider.getChildren(connected);
    const itemTypes = sections.map((s: any) => s.itemType);
    expect(itemTypes).toEqual(
      expect.arrayContaining(['serverInfo', 'clusterNodes', 'collectionsGroup'])
    );
  });

  it('collections group label reflects count', async () => {
    // inject 3 mock collections for Prod (id 2)
    (provider as any).collections['2'] = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];
    const rootChildren = await provider.getChildren();
    const connected: any = rootChildren.find((c: any) => c.label.endsWith('Prod'));
    expect(connected).toBeDefined();
    const sections = await provider.getChildren(connected);
    const collectionsGroup: any = sections.find((s: any) => s.itemType === 'collectionsGroup');
    expect(collectionsGroup.label).toMatch(/Collections \(3\)/);
  });

  it('contextValue set correctly on connected connection', async () => {
    const rootChildren = await provider.getChildren();
    const connected: any = rootChildren.find((c: any) => c.label.endsWith('Prod'));
    expect(connected).toBeDefined();
    expect(connected.contextValue).toBe('weaviateConnectionActive');
  });

  describe('getChildren for properties', () => {
    it('should handle null, undefined, and valid descriptions for properties', async () => {
      // 1. Setup mock data
      const connectionId = '2'; // 'Prod' connection is 'connected'
      const collectionName = 'TestCollection';
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            { name: 'propWithDesc', dataType: ['string'], description: 'This is a description.' },
            { name: 'propWithNullDesc', dataType: ['int'], description: null },
            { name: 'propWithUndefinedDesc', dataType: ['boolean'] },
            { name: 'propToTrim', dataType: ['text'], description: '  needs trimming  ' },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      // 2. Define the parent element for which we want children
      const propertiesElement = {
        itemType: 'properties',
        connectionId: connectionId,
        collectionName: collectionName,
        label: 'Properties (4)',
      };

      // 3. Call getChildren
      const propertyItems = await provider.getChildren(propertiesElement as any);

      // 4. Assertions
      expect(propertyItems).toHaveLength(4);

      const desc1 = propertyItems.find((p: any) => p.itemId === 'propWithDesc')?.description;
      const desc2 = propertyItems.find((p: any) => p.itemId === 'propWithNullDesc')?.description;
      const desc3 = propertyItems.find(
        (p: any) => p.itemId === 'propWithUndefinedDesc'
      )?.description;
      const desc4 = propertyItems.find((p: any) => p.itemId === 'propToTrim')?.description;

      expect(desc1).toBe('This is a description.');
      expect(desc2).toBe('');
      expect(desc3).toBe('');
      expect(desc4).toBe('needs trimming');
    });
  });

  describe('Nested Properties Support', () => {
    let provider: WeaviateTreeDataProvider;
    const connectionId = '2'; // 'Prod' connection is 'connected'
    const collectionName = 'TestNestedObject';

    beforeEach(() => {
      const mockCtx = {
        globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
        subscriptions: [],
      } as unknown as vscode.ExtensionContext;

      provider = new WeaviateTreeDataProvider(mockCtx);
    });

    it('should render properties with nested properties as collapsible', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'nested',
              dataType: ['object'],
              description: 'A nested object property',
              nestedProperties: [
                { name: 'text', dataType: ['text'], description: 'A text field' },
                { name: 'number', dataType: ['number'], description: 'A number field' },
              ],
            },
            {
              name: 'simpleText',
              dataType: ['text'],
              description: 'A regular text property',
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertiesElement = {
        itemType: 'properties',
        connectionId: connectionId,
        collectionName: collectionName,
        label: 'Properties (2)',
      };

      const propertyItems = await provider.getChildren(propertiesElement as any);

      expect(propertyItems).toHaveLength(2);

      const nestedProp = propertyItems.find((p: any) => p.itemId === 'nested');
      const simpleProp = propertyItems.find((p: any) => p.itemId === 'simpleText');

      expect(nestedProp).toBeDefined();
      expect(simpleProp).toBeDefined();
      expect(nestedProp?.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
      expect(simpleProp?.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    });

    it('should expand nested properties and show child properties', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'nested',
              dataType: ['object'],
              description: 'A nested object property',
              nestedProperties: [
                { name: 'text', dataType: ['text'], description: 'A text field' },
                { name: 'number', dataType: ['number'], description: 'A number field' },
                { name: 'boolean', dataType: ['boolean'], description: 'A boolean field' },
              ],
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertyItemElement = {
        itemType: 'propertyItem',
        connectionId: connectionId,
        collectionName: collectionName,
        itemId: 'nested',
        label: 'nested (object)',
      };

      const nestedChildren = await provider.getChildren(propertyItemElement as any);

      expect(nestedChildren).toHaveLength(3);

      const textProp = nestedChildren.find((p: any) => p.itemId === 'text');
      const numberProp = nestedChildren.find((p: any) => p.itemId === 'number');
      const booleanProp = nestedChildren.find((p: any) => p.itemId === 'boolean');

      expect(textProp).toBeDefined();
      expect(numberProp).toBeDefined();
      expect(booleanProp).toBeDefined();

      expect(textProp?.label).toBe('text (text)');
      expect(numberProp?.label).toBe('number (number)');
      expect(booleanProp?.label).toBe('boolean (boolean)');
    });

    it('should support deeply nested properties (3+ levels)', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'nested',
              dataType: ['object'],
              description: 'Level 1',
              nestedProperties: [
                {
                  name: 'child',
                  dataType: ['object'],
                  description: 'Level 2',
                  nestedProperties: [
                    {
                      name: 'deepChild',
                      dataType: ['object'],
                      description: 'Level 3',
                      nestedProperties: [
                        {
                          name: 'deepestField',
                          dataType: ['text'],
                          description: 'Level 4 - deepest field',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      // Level 1: Expand 'nested'
      const level1Element = {
        itemType: 'propertyItem',
        connectionId: connectionId,
        collectionName: collectionName,
        itemId: 'nested',
      };

      const level1Children = await provider.getChildren(level1Element as any);
      expect(level1Children).toHaveLength(1);
      expect(level1Children[0].itemId).toBe('child');

      // Level 2: Expand 'child'
      const level2Element = {
        itemType: 'propertyItem',
        connectionId: connectionId,
        collectionName: collectionName,
        itemId: 'child',
      };

      const level2Children = await provider.getChildren(level2Element as any);
      expect(level2Children).toHaveLength(1);
      expect(level2Children[0].itemId).toBe('deepChild');

      // Level 3: Expand 'deepChild'
      const level3Element = {
        itemType: 'propertyItem',
        connectionId: connectionId,
        collectionName: collectionName,
        itemId: 'deepChild',
      };

      const level3Children = await provider.getChildren(level3Element as any);
      expect(level3Children).toHaveLength(1);
      expect(level3Children[0].itemId).toBe('deepestField');
      expect(level3Children[0].label).toBe('deepestField (text)');
    });

    it('should handle object arrays with nested properties', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'arrayOfObjects',
              dataType: ['object[]'],
              description: 'An array of nested objects',
              nestedProperties: [
                { name: 'id', dataType: ['int'], description: 'ID field' },
                { name: 'value', dataType: ['text'], description: 'Value field' },
              ],
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertyItemElement = {
        itemType: 'propertyItem',
        connectionId: connectionId,
        collectionName: collectionName,
        itemId: 'arrayOfObjects',
      };

      const nestedChildren = await provider.getChildren(propertyItemElement as any);

      expect(nestedChildren).toHaveLength(2);

      const idProp = nestedChildren.find((p: any) => p.itemId === 'id');
      const valueProp = nestedChildren.find((p: any) => p.itemId === 'value');

      expect(idProp).toBeDefined();
      expect(valueProp).toBeDefined();
      expect(idProp?.label).toBe('id (int)');
      expect(valueProp?.label).toBe('value (text)');
    });

    it('should show property details for properties without nested properties', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'simpleText',
              dataType: ['text'],
              description: 'A regular text property',
              indexFilterable: true,
              indexSearchable: true,
              tokenization: 'word',
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertyItemElement = {
        itemType: 'propertyItem',
        connectionId: connectionId,
        collectionName: collectionName,
        itemId: 'simpleText',
      };

      const propertyDetails = await provider.getChildren(propertyItemElement as any);

      // Should show flattened property details
      expect(propertyDetails.length).toBeGreaterThan(0);

      // Check that some expected keys are present
      const labels = propertyDetails.map((p: any) => p.label);
      expect(labels.some((l: string) => l.includes('name'))).toBe(true);
      expect(labels.some((l: string) => l.includes('dataType'))).toBe(true);
    });

    it('should handle mixed properties with and without nested properties', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'nested',
              dataType: ['object'],
              nestedProperties: [{ name: 'text', dataType: ['text'] }],
            },
            {
              name: 'simpleText',
              dataType: ['text'],
            },
            {
              name: 'anotherNested',
              dataType: ['object'],
              nestedProperties: [{ name: 'number', dataType: ['number'] }],
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertiesElement = {
        itemType: 'properties',
        connectionId: connectionId,
        collectionName: collectionName,
        label: 'Properties (3)',
      };

      const propertyItems = await provider.getChildren(propertiesElement as any);

      expect(propertyItems).toHaveLength(3);

      // All properties should be collapsible
      propertyItems.forEach((prop: any) => {
        expect(prop.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
      });
    });

    it('should handle empty nested properties array', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'emptyNested',
              dataType: ['object'],
              nestedProperties: [],
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertyItemElement = {
        itemType: 'propertyItem',
        connectionId: connectionId,
        collectionName: collectionName,
        itemId: 'emptyNested',
      };

      const nestedChildren = await provider.getChildren(propertyItemElement as any);

      // Should show property details since nestedProperties is empty
      expect(nestedChildren.length).toBeGreaterThan(0);
    });

    it('should handle property not found in nested structure', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'nested',
              dataType: ['object'],
              nestedProperties: [{ name: 'text', dataType: ['text'] }],
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertyItemElement = {
        itemType: 'propertyItem',
        connectionId: connectionId,
        collectionName: collectionName,
        itemId: 'nonexistent',
      };

      const result = await provider.getChildren(propertyItemElement as any);

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('Property not found');
    });

    it('should handle dataType as string (Weaviate import format)', async () => {
      // When importing from Weaviate, dataType comes as string instead of array
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'nested',
              dataType: 'object', // String format instead of array
              description: 'A nested object property',
              nestedProperties: [
                { name: 'text', dataType: 'text', description: 'Text field' },
                { name: 'number', dataType: 'number', description: 'Number field' },
              ],
            },
            {
              name: 'simpleText',
              dataType: 'text', // String format
              description: 'A regular text property',
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertiesElement = {
        itemType: 'properties',
        connectionId: connectionId,
        collectionName: collectionName,
        label: 'Properties (2)',
      };

      const propertyItems = await provider.getChildren(propertiesElement as any);

      expect(propertyItems).toHaveLength(2);

      const nestedProp = propertyItems.find((p: any) => p.itemId === 'nested');
      const simpleProp = propertyItems.find((p: any) => p.itemId === 'simpleText');

      expect(nestedProp).toBeDefined();
      expect(simpleProp).toBeDefined();

      // Check that labels display correctly with string dataType
      expect(nestedProp?.label).toBe('nested (object)');
      expect(simpleProp?.label).toBe('simpleText (text)');

      // Both should be collapsible
      expect(nestedProp?.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
      expect(simpleProp?.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    });

    it('should expand nested properties when dataType is string', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'nested',
              dataType: 'object', // String format
              nestedProperties: [
                { name: 'text', dataType: 'text' },
                { name: 'number', dataType: 'number' },
                { name: 'boolean', dataType: 'boolean' },
              ],
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertyItemElement = {
        itemType: 'propertyItem',
        connectionId: connectionId,
        collectionName: collectionName,
        itemId: 'nested',
      };

      const nestedChildren = await provider.getChildren(propertyItemElement as any);

      expect(nestedChildren).toHaveLength(3);

      const labels = nestedChildren.map((p: any) => p.label);
      expect(labels).toContain('text (text)');
      expect(labels).toContain('number (number)');
      expect(labels).toContain('boolean (boolean)');
    });

    it('should handle mixed dataType formats (string and array)', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'nested1',
              dataType: 'object', // String format
              nestedProperties: [{ name: 'field1', dataType: 'text' }],
            },
            {
              name: 'nested2',
              dataType: ['object'], // Array format
              nestedProperties: [{ name: 'field2', dataType: ['text'] }],
            },
            {
              name: 'simple1',
              dataType: 'text', // String format
            },
            {
              name: 'simple2',
              dataType: ['text'], // Array format
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertiesElement = {
        itemType: 'properties',
        connectionId: connectionId,
        collectionName: collectionName,
        label: 'Properties (4)',
      };

      const propertyItems = await provider.getChildren(propertiesElement as any);

      expect(propertyItems).toHaveLength(4);

      // All should render correctly regardless of format
      const labels = propertyItems.map((p: any) => p.label);
      expect(labels).toContain('nested1 (object)');
      expect(labels).toContain('nested2 (object)');
      expect(labels).toContain('simple1 (text)');
      expect(labels).toContain('simple2 (text)');
    });

    it('should handle case-insensitive dataType values', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'nested1',
              dataType: 'Object', // Capitalized
              nestedProperties: [{ name: 'field1', dataType: 'Text' }],
            },
            {
              name: 'nested2',
              dataType: 'OBJECT', // All caps
              nestedProperties: [{ name: 'field2', dataType: 'NUMBER' }],
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      const propertiesElement = {
        itemType: 'properties',
        connectionId: connectionId,
        collectionName: collectionName,
        label: 'Properties (2)',
      };

      const propertyItems = await provider.getChildren(propertiesElement as any);

      expect(propertyItems).toHaveLength(2);

      // Should still recognize them as object types
      const labels = propertyItems.map((p: any) => p.label);
      expect(labels).toContain('nested1 (Object)');
      expect(labels).toContain('nested2 (OBJECT)');

      // Should be able to expand both
      const nested1Element = {
        itemType: 'propertyItem',
        connectionId: connectionId,
        collectionName: collectionName,
        itemId: 'nested1',
      };

      const nested1Children = await provider.getChildren(nested1Element as any);
      expect(nested1Children).toHaveLength(1);
      expect(nested1Children[0].label).toBe('field1 (Text)');
    });

    it('should handle deeply nested properties with string dataType', async () => {
      const mockCollection = {
        label: collectionName,
        itemType: 'collection',
        connectionId: connectionId,
        collectionName: collectionName,
        schema: {
          class: collectionName,
          properties: [
            {
              name: 'level1',
              dataType: 'object', // String format
              nestedProperties: [
                {
                  name: 'level2',
                  dataType: 'object',
                  nestedProperties: [
                    {
                      name: 'level3',
                      dataType: 'object',
                      nestedProperties: [
                        {
                          name: 'deepField',
                          dataType: 'text',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      (provider as any).collections[connectionId] = [mockCollection];

      // Navigate through all levels
      const level1 = await provider.getChildren({
        itemType: 'propertyItem',
        connectionId,
        collectionName,
        itemId: 'level1',
      } as any);

      expect(level1).toHaveLength(1);
      expect(level1[0].itemId).toBe('level2');

      const level2 = await provider.getChildren({
        itemType: 'propertyItem',
        connectionId,
        collectionName,
        itemId: 'level2',
      } as any);

      expect(level2).toHaveLength(1);
      expect(level2[0].itemId).toBe('level3');

      const level3 = await provider.getChildren({
        itemType: 'propertyItem',
        connectionId,
        collectionName,
        itemId: 'level3',
      } as any);

      expect(level3).toHaveLength(1);
      expect(level3[0].itemId).toBe('deepField');
      expect(level3[0].label).toBe('deepField (text)');
    });
  });

  describe('deleteAllCollections', () => {
    let provider: WeaviateTreeDataProvider;

    beforeEach(() => {
      // Create a fresh provider instance for isolated testing
      const mockCtx = {
        globalState: { get: jest.fn().mockReturnValue([]), update: jest.fn() },
        subscriptions: [],
      } as unknown as vscode.ExtensionContext;

      provider = new WeaviateTreeDataProvider(mockCtx);
    });

    it('should call client.collections.deleteAll and clear collections state', async () => {
      const mockClient = {
        collections: {
          deleteAll: jest.fn(),
        },
      };

      const mockConnectionManager = {
        getConnection: jest.fn().mockReturnValue({ id: '1', name: 'Test Connection' }),
        getClient: jest.fn().mockReturnValue(mockClient),
      };

      // Mock the connectionManager property
      (provider as any).connectionManager = mockConnectionManager;

      // Set up some collections to be deleted
      (provider as any).collections['1'] = [
        { label: 'Collection1' },
        { label: 'Collection2' },
        { label: 'Collection3' },
      ];

      // Mock the refresh method
      const refreshSpy = jest.spyOn(provider, 'refresh').mockImplementation(() => {});

      await provider.deleteAllCollections('1');

      expect(mockConnectionManager.getConnection).toHaveBeenCalledWith('1');
      expect(mockConnectionManager.getClient).toHaveBeenCalledWith('1');
      expect(mockClient.collections.deleteAll).toHaveBeenCalled();
      expect((provider as any).collections['1']).toEqual([]);
      expect(refreshSpy).toHaveBeenCalled();

      refreshSpy.mockRestore();
    });

    it('should throw error when connection not found', async () => {
      const mockConnectionManager = {
        getConnection: jest.fn().mockReturnValue(null),
        getClient: jest.fn(),
      };

      (provider as any).connectionManager = mockConnectionManager;

      // Suppress console.error for this test since we expect an error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(provider.deleteAllCollections('invalid')).rejects.toThrow(
        'Failed to delete all collections: Connection not found'
      );

      consoleSpy.mockRestore();
    });

    it('should throw error when client not initialized', async () => {
      const mockConnectionManager = {
        getConnection: jest.fn().mockReturnValue({ id: '1', name: 'Test Connection' }),
        getClient: jest.fn().mockReturnValue(null),
      };

      (provider as any).connectionManager = mockConnectionManager;

      // Suppress console.error for this test since we expect an error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(provider.deleteAllCollections('1')).rejects.toThrow(
        'Failed to delete all collections: Client not initialized'
      );

      consoleSpy.mockRestore();
    });

    it('should handle client API errors gracefully', async () => {
      const mockClient = {
        collections: {
          deleteAll: jest.fn().mockRejectedValue(new Error('API Error')),
        },
      };

      const mockConnectionManager = {
        getConnection: jest.fn().mockReturnValue({ id: '1', name: 'Test Connection' }),
        getClient: jest.fn().mockReturnValue(mockClient),
      };

      (provider as any).connectionManager = mockConnectionManager;

      // Suppress console.error for this test since we expect an error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(provider.deleteAllCollections('1')).rejects.toThrow(
        'Failed to delete all collections: API Error'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('forceRefresh', () => {
    it('should update connections from ConnectionManager and fire tree data change event', async () => {
      const fireEventSpy = jest.spyOn((provider as any)._onDidChangeTreeData, 'fire');

      // Initial connections
      const initialConnections = (provider as any).connections;
      expect(initialConnections).toHaveLength(mockConnections.length);

      // Call forceRefresh
      await provider.forceRefresh();

      // Verify connections were updated
      const updatedConnections = (provider as any).connections;
      expect(updatedConnections).toHaveLength(mockConnections.length);

      // Verify event was fired
      expect(fireEventSpy).toHaveBeenCalled();

      fireEventSpy.mockRestore();
    });

    it('should bypass debounce mechanism when forcing refresh', async () => {
      const fireEventSpy = jest.spyOn((provider as any)._onDidChangeTreeData, 'fire');

      // Call forceRefresh multiple times rapidly
      await provider.forceRefresh();
      await provider.forceRefresh();
      await provider.forceRefresh();

      // Verify event was fired for each call (no debouncing)
      expect(fireEventSpy).toHaveBeenCalledTimes(3);

      fireEventSpy.mockRestore();
    });

    it('should not affect collections cache when forcing refresh', async () => {
      // Set up some collections in cache
      const testCollections = [{ label: 'TestCollection' }];
      (provider as any).collections['2'] = testCollections;

      await provider.forceRefresh();

      // Verify collections cache is preserved
      expect((provider as any).collections['2']).toEqual(testCollections);
    });

    it('should update connections list from ConnectionManager', async () => {
      const fireEventSpy = jest.spyOn((provider as any)._onDidChangeTreeData, 'fire');

      // Get initial connection count
      const initialCount = (provider as any).connections.length;

      await provider.forceRefresh();

      // Verify connections are still available after refresh
      expect((provider as any).connections.length).toBe(initialCount);
      expect(fireEventSpy).toHaveBeenCalled();

      fireEventSpy.mockRestore();
    });
  });

  describe('sortAliases', () => {
    it('should sort aliases alphabetically by alias name', () => {
      const aliases = [
        { alias: 'zebra', collection: 'col1' },
        { alias: 'apple', collection: 'col2' },
        { alias: 'banana', collection: 'col3' },
      ];

      const sorted = (provider as any).sortAliases(aliases);

      expect(sorted).toEqual([
        { alias: 'apple', collection: 'col2' },
        { alias: 'banana', collection: 'col3' },
        { alias: 'zebra', collection: 'col1' },
      ]);
    });

    it('should sort by collection name when alias names are the same', () => {
      const aliases = [
        { alias: 'myalias', collection: 'zebra' },
        { alias: 'myalias', collection: 'apple' },
        { alias: 'myalias', collection: 'banana' },
      ];

      const sorted = (provider as any).sortAliases(aliases);

      expect(sorted).toEqual([
        { alias: 'myalias', collection: 'apple' },
        { alias: 'myalias', collection: 'banana' },
        { alias: 'myalias', collection: 'zebra' },
      ]);
    });

    it('should handle mixed case sorting correctly', () => {
      const aliases = [
        { alias: 'Zebra', collection: 'col1' },
        { alias: 'apple', collection: 'col2' },
        { alias: 'Banana', collection: 'col3' },
      ];

      const sorted = (provider as any).sortAliases(aliases);

      // localeCompare should handle case-insensitive sorting
      expect(sorted[0].alias.toLowerCase()).toBe('apple');
      expect(sorted[1].alias.toLowerCase()).toBe('banana');
      expect(sorted[2].alias.toLowerCase()).toBe('zebra');
    });

    it('should return empty array when given empty array', () => {
      const sorted = (provider as any).sortAliases([]);
      expect(sorted).toEqual([]);
    });

    it('should not modify the original array', () => {
      const aliases = [
        { alias: 'zebra', collection: 'col1' },
        { alias: 'apple', collection: 'col2' },
      ];

      const originalOrder = [...aliases];
      const sorted = (provider as any).sortAliases(aliases);

      expect(aliases).toEqual(originalOrder);
      expect(sorted).not.toBe(aliases);
    });

    it('should handle single element array', () => {
      const aliases = [{ alias: 'single', collection: 'col1' }];
      const sorted = (provider as any).sortAliases(aliases);

      expect(sorted).toEqual([{ alias: 'single', collection: 'col1' }]);
    });

    it('should maintain stable sort for identical elements', () => {
      const aliases = [
        { alias: 'same', collection: 'same' },
        { alias: 'same', collection: 'same' },
      ];

      const sorted = (provider as any).sortAliases(aliases);

      expect(sorted).toEqual([
        { alias: 'same', collection: 'same' },
        { alias: 'same', collection: 'same' },
      ]);
    });
  });
});
