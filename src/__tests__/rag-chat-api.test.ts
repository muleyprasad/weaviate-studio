import { RagChatAPI } from '../rag-chat/extension/RagChatAPI';
import type { WeaviateClient } from 'weaviate-client';
import { Filters } from 'weaviate-client';
import { isTimeoutError, createTimeoutError } from '../shared/timeout';
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
  });

  describe('getCollections', () => {
    it('returns sorted list of collections with generative module configured', async () => {
      const mockCollections = [
        { name: 'CollectionC', generative: { name: 'none' } }, // filtered out
        { name: 'CollectionB', generative: { name: 'openai' } }, // included
        { name: 'CollectionA', generative: null }, // filtered out
        { name: 'CollectionD', generative: { name: 'cohere' } }, // included
      ];

      mockClient.collections.listAll.mockResolvedValue(mockCollections);

      const result = await api.getCollections();

      expect(result).toEqual(['CollectionB', 'CollectionD']); // Sorted alphabetically
    });

    it('throws timeout error when listAll takes too long', async () => {
      mockClient.collections.listAll.mockReturnValue(new Promise(() => {}));

      jest
        .spyOn(timeoutModule, 'withTimeout')
        .mockRejectedValueOnce(new Error('Request timed out'));

      await expect(api.getCollections()).rejects.toThrow(/List collections timed out after/);
    });
  });
});
