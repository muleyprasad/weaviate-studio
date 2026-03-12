import { RagChatAPI } from '../rag-chat/extension/RagChatAPI';
import type { WeaviateClient } from 'weaviate-client';
import { Filters } from 'weaviate-client';
import * as timeoutModule from '../shared/timeout';

// Mock the workspace configuration to return a specific timeout
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(120000), // Default 120s timeout
    }),
  },
}));

describe('RagChatAPI', () => {
  let mockClient: any;
  let api: RagChatAPI;

  beforeEach(() => {
    // Basic mock structure for WeaviateClient
    mockClient = {
      collections: {
        get: jest.fn(),
        listAll: jest.fn(),
      },
    };

    api = new RagChatAPI(mockClient as unknown as WeaviateClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeRagQuery', () => {
    it('throws error for empty collection name', async () => {
      await expect(api.executeRagQuery({ collectionName: '', question: 'test' })).rejects.toThrow(
        'Collection name cannot be empty.'
      );
    });

    it('throws error for whitespace-only collection name', async () => {
      await expect(
        api.executeRagQuery({ collectionName: '   ', question: 'test' })
      ).rejects.toThrow('Collection name cannot be empty.');
    });

    it('throws error for invalid characters in collection name', async () => {
      await expect(
        api.executeRagQuery({ collectionName: 'invalid!name', question: 'test' })
      ).rejects.toThrow('Collection name contains invalid characters.');
    });

    it('returns answer and context objects on success', async () => {
      const mockResult = {
        generated: 'Test answer',
        objects: [
          {
            uuid: '123',
            properties: { text: 'content' },
            metadata: { distance: 0.1, certainty: 0.9, score: 0.8 },
          },
        ],
      };

      const mockCollection = {
        generate: {
          hybrid: jest.fn().mockResolvedValue(mockResult),
        },
      };

      mockClient.collections.get.mockReturnValue(mockCollection);

      const result = await api.executeRagQuery({
        collectionName: 'TestCollection',
        question: 'What is this?',
      });

      expect(result.answer).toBe('Test answer');
      expect(result.contextObjects).toHaveLength(1);
      expect(result.contextObjects[0]).toEqual({
        uuid: '123',
        properties: { text: 'content' },
        distance: 0.1,
        certainty: 0.9,
        score: 0.8,
      });

      expect(mockCollection.generate.hybrid).toHaveBeenCalledWith(
        'What is this?',
        { groupedTask: 'What is this?' },
        { limit: 5, returnMetadata: ['distance', 'certainty', 'score'] }
      );
    });

    it('returns empty string answer when Weaviate returns null for generated', async () => {
      const mockResult = {
        generated: null,
        objects: [],
      };
      const mockCollection = {
        generate: { hybrid: jest.fn().mockResolvedValue(mockResult) },
      };
      mockClient.collections.get.mockReturnValue(mockCollection);

      const result = await api.executeRagQuery({
        collectionName: 'TestCollection',
        question: 'What is this?',
      });

      expect(result.answer).toBe('');
      expect(result.contextObjects).toHaveLength(0);
    });

    it('falls back to bm25 when hasVectorizer is false', async () => {
      const mockResult = {
        generated: 'BM25 answer',
        objects: [],
      };

      const mockCollection = {
        generate: {
          hybrid: jest.fn(),
          bm25: jest.fn().mockResolvedValue(mockResult),
        },
      };

      mockClient.collections.get.mockReturnValue(mockCollection);

      const result = await api.executeRagQuery({
        collectionName: 'TestCollection',
        question: 'What is this?',
        hasVectorizer: false,
      });

      expect(result.answer).toBe('BM25 answer');
      expect(mockCollection.generate.hybrid).not.toHaveBeenCalled();
      expect(mockCollection.generate.bm25).toHaveBeenCalledWith(
        'What is this?',
        { groupedTask: 'What is this?' },
        { limit: 5, returnMetadata: ['distance', 'certainty', 'score'] }
      );
    });

    it('throws timeout error when query takes too long', async () => {
      const mockCollection = {
        generate: {
          hybrid: jest.fn().mockReturnValue(new Promise(() => {})), // Never resolves
        },
      };

      mockClient.collections.get.mockReturnValue(mockCollection);

      // Spy on withTimeout to manually force a rejection
      jest
        .spyOn(timeoutModule, 'withTimeout')
        .mockRejectedValueOnce(new Error('Request timed out'));

      await expect(
        api.executeRagQuery({
          collectionName: 'TimeoutCollection',
          question: 'test',
        })
      ).rejects.toThrow(/timed out after/);
    });

    // ─── Filter Building ────────────────────────────────────────────────

    describe('filter building (where parameter)', () => {
      let mockCollection: any;
      let mockFilterBuilder: any;

      beforeEach(() => {
        // Create a reusable mock filter builder
        mockFilterBuilder = {
          equal: jest.fn().mockReturnValue({ _built: 'equal' }),
          notEqual: jest.fn().mockReturnValue({ _built: 'notEqual' }),
          greaterThan: jest.fn().mockReturnValue({ _built: 'greaterThan' }),
          greaterOrEqual: jest.fn().mockReturnValue({ _built: 'greaterOrEqual' }),
          lessThan: jest.fn().mockReturnValue({ _built: 'lessThan' }),
          lessOrEqual: jest.fn().mockReturnValue({ _built: 'lessOrEqual' }),
          like: jest.fn().mockReturnValue({ _built: 'like' }),
          isNull: jest.fn().mockReturnValue({ _built: 'isNull' }),
        };

        mockCollection = {
          filter: {
            byProperty: jest.fn().mockReturnValue(mockFilterBuilder),
          },
          generate: {
            hybrid: jest.fn().mockResolvedValue({ generated: 'answer', objects: [] }),
          },
        };

        mockClient.collections.get.mockReturnValue(mockCollection);
        // Reset Filters mock call counts between tests
        (Filters.and as jest.Mock).mockClear();
        (Filters.or as jest.Mock).mockClear();
      });

      it('passes no filters field when where array is empty', async () => {
        await api.executeRagQuery({
          collectionName: 'Col',
          question: 'q',
          where: [],
        });

        expect(mockCollection.generate.hybrid).toHaveBeenCalledWith(
          'q',
          { groupedTask: 'q' },
          { limit: 5, returnMetadata: ['distance', 'certainty', 'score'] }
        );
        // No `filters` key in the options
        const callArgs = mockCollection.generate.hybrid.mock.calls[0][2];
        expect(callArgs).not.toHaveProperty('filters');
      });

      it.each([
        ['Equal', 'equal', 'hello'],
        ['NotEqual', 'notEqual', 'world'],
        ['GreaterThan', 'greaterThan', 42],
        ['GreaterThanEqual', 'greaterOrEqual', 42],
        ['LessThan', 'lessThan', 10],
        ['LessThanEqual', 'lessOrEqual', 10],
        ['Like', 'like', 'foo*'],
      ] as const)(
        'calls the correct filter method for operator "%s"',
        async (operator, builderMethod, value) => {
          await api.executeRagQuery({
            collectionName: 'Col',
            question: 'q',
            where: [{ id: 'f1', path: 'myProp', operator, value }],
          });

          expect(mockCollection.filter.byProperty).toHaveBeenCalledWith('myProp');
          expect(mockFilterBuilder[builderMethod]).toHaveBeenCalledWith(value);
        }
      );

      it('calls isNull(true) for IsNull operator', async () => {
        await api.executeRagQuery({
          collectionName: 'Col',
          question: 'q',
          where: [{ id: 'f1', path: 'myProp', operator: 'IsNull', value: null }],
        });

        expect(mockFilterBuilder.isNull).toHaveBeenCalledWith(true);
      });

      it('calls isNull(false) for IsNotNull operator', async () => {
        await api.executeRagQuery({
          collectionName: 'Col',
          question: 'q',
          where: [{ id: 'f1', path: 'myProp', operator: 'IsNotNull', value: null }],
        });

        expect(mockFilterBuilder.isNull).toHaveBeenCalledWith(false);
      });

      it('uses Filters.and() by default (AND match mode)', async () => {
        await api.executeRagQuery({
          collectionName: 'Col',
          question: 'q',
          where: [
            { id: 'f1', path: 'propA', operator: 'Equal', value: 'a' },
            { id: 'f2', path: 'propB', operator: 'Equal', value: 'b' },
          ],
          matchMode: 'AND',
        });

        expect(Filters.and).toHaveBeenCalled();
        expect(Filters.or).not.toHaveBeenCalled();
      });

      it('uses Filters.or() when match mode is OR', async () => {
        await api.executeRagQuery({
          collectionName: 'Col',
          question: 'q',
          where: [
            { id: 'f1', path: 'propA', operator: 'Equal', value: 'a' },
            { id: 'f2', path: 'propB', operator: 'Equal', value: 'b' },
          ],
          matchMode: 'OR',
        });

        expect(Filters.or).toHaveBeenCalled();
        expect(Filters.and).not.toHaveBeenCalled();
      });

      it('silently drops filters with unsupported operators without throwing', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(
          api.executeRagQuery({
            collectionName: 'Col',
            question: 'q',
            where: [{ id: 'f1', path: 'myProp', operator: 'ContainsAny' as any, value: 'x' }],
          })
        ).resolves.not.toThrow();

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Dropped filter'));

        // No filters key — all were dropped
        const callArgs = mockCollection.generate.hybrid.mock.calls[0][2];
        expect(callArgs).not.toHaveProperty('filters');

        warnSpy.mockRestore();
      });

      it('silently drops individual filters that throw during construction', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Make byProperty throw for the first call, succeed for the second
        mockCollection.filter.byProperty
          .mockImplementationOnce(() => {
            throw new Error('Bad property');
          })
          .mockReturnValue(mockFilterBuilder);

        // Note: with the first filter dropped and the second valid, Filters.and should be called
        // with only the surviving clause. Result should resolve, not throw.
        await expect(
          api.executeRagQuery({
            collectionName: 'Col',
            question: 'q',
            where: [
              { id: 'f1', path: 'badProp', operator: 'Equal', value: 'x' },
              { id: 'f2', path: 'goodProp', operator: 'Equal', value: 'y' },
            ],
          })
        ).resolves.not.toThrow();

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Dropped filter for path "badProp"')
        );

        warnSpy.mockRestore();
      });
    });
  });

  describe('getCollectionInfos', () => {
    it('returns sorted list of all collections with their metadata', async () => {
      const mockCollections = [
        { name: 'CollectionC', generative: { name: 'none' }, vectorizers: {} },
        {
          name: 'CollectionB',
          generative: { name: 'openai' },
          vectorizers: { 'text2vec-openai': {} },
        },
        { name: 'CollectionA', generative: null, vectorizers: undefined },
        {
          name: 'CollectionD',
          generative: { name: 'cohere' },
          vectorizers: { 'text2vec-cohere': {} },
        },
      ];

      mockClient.collections.listAll.mockResolvedValue(mockCollections);

      const result = await api.getCollectionInfos();

      expect(result).toEqual([
        { name: 'CollectionA', hasVectorizer: false, generativeModule: null },
        { name: 'CollectionB', hasVectorizer: true, generativeModule: 'openai' },
        { name: 'CollectionC', hasVectorizer: false, generativeModule: null },
        { name: 'CollectionD', hasVectorizer: true, generativeModule: 'cohere' },
      ]);
    });

    it('throws timeout error when listAll takes too long', async () => {
      mockClient.collections.listAll.mockReturnValue(new Promise(() => {}));

      jest
        .spyOn(timeoutModule, 'withTimeout')
        .mockRejectedValueOnce(new Error('Request timed out'));

      await expect(api.getCollectionInfos()).rejects.toThrow(/List collections timed out after/);
    });
  });
});
