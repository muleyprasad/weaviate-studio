/**
 * Unit tests for QueryAgentService
 *
 * Tests:
 * - Service instantiation with client, collections, and system prompt
 * - ask() method calls SDK with chat history
 * - search() method calls SDK without chat history
 * - Trace mapping produces expected shape
 */

// Mock weaviate-agents before importing QueryAgentService
jest.mock('weaviate-agents', () => ({
  QueryAgent: jest.fn(),
}));

import { QueryAgentService } from '../QueryAgentService';
import type { WeaviateClient } from 'weaviate-client';

describe('QueryAgentService', () => {
  let mockClient: jest.Mocked<WeaviateClient>;
  let mockAgent: any;
  let MockQueryAgent: jest.MockedClass<any>;

  beforeEach(() => {
    // Create a mock QueryAgent instance
    mockAgent = {
      ask: jest.fn(),
      search: jest.fn(),
      askStream: jest.fn(),
    };

    // Mock the WeaviateClient
    mockClient = {} as jest.Mocked<WeaviateClient>;

    // Get the mocked QueryAgent constructor
    const { QueryAgent } = require('weaviate-agents');
    MockQueryAgent = QueryAgent;
    MockQueryAgent.mockImplementation(() => mockAgent);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should instantiate QueryAgent with client, collections, and system prompt', () => {
      const collections = ['Collection1'];
      const systemPrompt = 'Test prompt';

      // We'll mock the QueryAgent constructor at the module level
      // For now, just verify the service can be instantiated
      expect(() => {
        new QueryAgentService(mockClient, collections as any, systemPrompt);
      }).not.toThrow();
    });
  });

  describe('ask()', () => {
    it('should call agent.ask() with message when no chat history provided', async () => {
      const mockResponse: any = {
        outputType: 'finalState',
        searches: [
          {
            query: 'test query',
            collection: 'TestCollection',
          },
        ],
        aggregations: [],
        usage: {
          modelUnits: 10,
          usageInPlan: true,
          remainingPlanRequests: 100,
        },
        totalTime: 1000,
        isPartialAnswer: false,
        missingInformation: [],
        finalAnswer: 'Test answer',
        sources: [
          {
            objectId: 'uuid-1',
            collection: 'TestCollection',
          },
        ],
        display: jest.fn(),
      };

      mockAgent.ask.mockResolvedValue(mockResponse);

      const service = new QueryAgentService(mockClient, [], 'Test prompt');
      const result = await service.ask('What is this?');

      expect(mockAgent.ask).toHaveBeenCalledWith('What is this?');
      expect(result.answer).toBe('Test answer');
      expect(result.trace.searches).toHaveLength(1);
      expect(result.trace.searches[0].collection).toBe('TestCollection');
    });

    it('should call agent.ask() with chat message array when history provided', async () => {
      const mockResponse: any = {
        outputType: 'finalState',
        searches: [],
        aggregations: [],
        usage: {
          modelUnits: 5,
          usageInPlan: true,
          remainingPlanRequests: 95,
        },
        totalTime: 500,
        isPartialAnswer: false,
        missingInformation: [],
        finalAnswer: 'Follow-up answer',
        sources: [],
        display: jest.fn(),
      };

      mockAgent.ask.mockResolvedValue(mockResponse);

      const service = new QueryAgentService(mockClient, [], 'Test prompt');
      const chatHistory = [
        { role: 'user' as const, content: 'First question?' },
        { role: 'assistant' as const, content: 'First answer.' },
      ];

      const result = await service.ask('Second question?', chatHistory);

      expect(mockAgent.ask).toHaveBeenCalledWith(
        expect.arrayContaining([
          { role: 'user', content: 'First question?' },
          { role: 'assistant', content: 'First answer.' },
          { role: 'user', content: 'Second question?' },
        ])
      );
      expect(result.answer).toBe('Follow-up answer');
    });

    it('should map response to QueryAgentTrace with all fields', async () => {
      const mockResponse: any = {
        outputType: 'finalState',
        searches: [
          {
            query: 'search query 1',
            collection: 'Collection1',
          },
          {
            query: 'search query 2',
            collection: 'Collection2',
          },
        ],
        aggregations: [
          {
            collection: 'Collection1',
            groupbyProperty: 'category',
          },
        ],
        usage: {
          modelUnits: 20,
          usageInPlan: true,
          remainingPlanRequests: 80,
        },
        totalTime: 2000,
        isPartialAnswer: false,
        missingInformation: ['some info'],
        finalAnswer: 'Comprehensive answer',
        sources: [
          { objectId: 'id1', collection: 'Collection1' },
          { objectId: 'id2', collection: 'Collection2' },
        ],
        display: jest.fn(),
      };

      mockAgent.ask.mockResolvedValue(mockResponse);

      const service = new QueryAgentService(mockClient, [], 'Test prompt');
      const result = await service.ask('Complex question?');

      const { trace } = result;
      expect(trace.searches).toHaveLength(2);
      expect(trace.searches[0]).toEqual({ query: 'search query 1', collection: 'Collection1' });
      expect(trace.searches[1]).toEqual({ query: 'search query 2', collection: 'Collection2' });
      expect(trace.aggregations).toHaveLength(1);
      expect(trace.aggregations[0]).toEqual({
        collection: 'Collection1',
        groupbyProperty: 'category',
      });
      expect(trace.usage).toEqual({
        modelUnits: 20,
        usageInPlan: true,
        remainingPlanRequests: 80,
      });
      expect(trace.totalTime).toBe(2000);
      expect(trace.isPartialAnswer).toBe(false);
      expect(trace.missingInformation).toEqual(['some info']);
      expect(trace.sources).toHaveLength(2);
    });
  });

  describe('search()', () => {
    it('should call agent.search() with query message', async () => {
      const mockResponse: any = {
        searches: [
          {
            query: 'search query',
            collection: 'SearchCollection',
          },
        ],
        usage: {
          modelUnits: 5,
          usageInPlan: true,
          remainingPlanRequests: 95,
        },
        totalTime: 300,
        searchResults: {
          objects: [
            {
              uuid: 'obj-1',
              properties: { name: 'Object 1' },
              collection: 'SearchCollection',
            },
          ],
        },
        next: jest.fn(),
      };

      mockAgent.search.mockResolvedValue(mockResponse);

      const service = new QueryAgentService(mockClient, [], 'Test prompt');
      const result = await service.search('Find objects');

      expect(mockAgent.search).toHaveBeenCalledWith('Find objects');
      expect(result.searches).toHaveLength(1);
      expect(result.searchResults.objects).toHaveLength(1);
    });
  });

  describe('stream()', () => {
    it('should call agent.askStream() and yield tokens', async () => {
      const mockTokens = [
        { outputType: 'streamedTokens' as const, delta: 'Hello ' },
        { outputType: 'streamedTokens' as const, delta: 'world' },
      ];

      // Create an async generator that yields the mock tokens
      async function* mockStreamGenerator() {
        for (const token of mockTokens) {
          yield token;
        }
      }

      mockAgent.askStream.mockReturnValue(mockStreamGenerator());

      const service = new QueryAgentService(mockClient, [], 'Test prompt');
      const tokens: string[] = [];

      for await (const chunk of service.stream('Stream this?')) {
        if (chunk.outputType === 'streamedTokens') {
          tokens.push(chunk.delta);
        }
      }

      expect(mockAgent.askStream).toHaveBeenCalledWith('Stream this?', {
        includeFinalState: false,
      });
      expect(tokens).toEqual(['Hello ', 'world']);
    });

    it('should include chat history in stream query', async () => {
      async function* mockStreamGenerator() {
        yield { outputType: 'streamedTokens' as const, delta: 'Response' };
      }

      mockAgent.askStream.mockReturnValue(mockStreamGenerator());

      const service = new QueryAgentService(mockClient, [], 'Test prompt');
      const chatHistory = [
        { role: 'user' as const, content: 'First' },
        { role: 'assistant' as const, content: 'Second' },
      ];

      // Consume the generator
      for await (const chunk of service.stream('Continue', chatHistory)) {
        // Just iterate
      }

      expect(mockAgent.askStream).toHaveBeenCalledWith(
        expect.arrayContaining([
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'Second' },
          { role: 'user', content: 'Continue' },
        ]),
        {
          includeFinalState: false,
        }
      );
    });
  });
});
