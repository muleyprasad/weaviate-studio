// @ts-nocheck
/**
 * QueryAgentService — Wrapper around weaviate-agents QueryAgent SDK
 *
 * Encapsulates agent instantiation and method calls, providing:
 * - ask(message, chatHistory): Answer questions with trace
 * - search(message): Pure retrieval (no LLM)
 * - stream(message): Streaming token response (stub for future)
 *
 * Response shapes are mapped to internal types via traceMapping.ts
 *
 * Note: @ts-nocheck suppresses ESM/CommonJS type incompatibility warnings.
 * Webpack handles the actual transpilation correctly; TypeScript just doesn't
 * understand the hybrid module setup. See types.ts for context.
 */

import type { WeaviateClient } from 'weaviate-client';
import {
  QueryAgent,
  type QueryAgentChatMessage,
  type QueryAgentAskResponse,
  type QueryAgentSearchResponse,
  type QueryAgentStreamChunk,
} from './types';
// Import QueryAgentCollection directly from weaviate-agents since it's not re-exported in types.ts
import type { QueryAgentCollection } from 'weaviate-agents';
import { mapAskResponseToTrace, mapChatHistory } from './traceMapping';
import type { QueryAgentTrace } from './types';

/**
 * Service for executing Query Agent queries against Weaviate
 *
 * Instantiates and manages a QueryAgent instance with a Weaviate client,
 * collections list, and system prompt.
 */
export class QueryAgentService {
  private agent: QueryAgent;

  /**
   * Creates a new QueryAgentService
   *
   * @param client - Weaviate client instance
   * @param collections - List of collection names or configs to query
   * @param systemPrompt - System prompt to guide the agent's behavior
   */
  constructor(client: WeaviateClient, collections: QueryAgentCollection[], systemPrompt: string) {
    this.agent = new QueryAgent(client, {
      collections,
      systemPrompt,
    });
  }

  /**
   * Ask a question and get an answer with trace metadata
   *
   * @param message - The question or statement to ask
   * @param chatHistory - Optional chat history (list of { role, content } messages)
   * @returns Answer text and trace (searches, collections, usage, etc.)
   */
  async ask(
    message: string,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{ answer: string; trace: QueryAgentTrace }> {
    // Construct query: if there's chat history, include it; otherwise just the message
    const query: QueryAgentChatMessage[] | string = chatHistory
      ? [...mapChatHistory(chatHistory), { role: 'user', content: message }]
      : message;

    const response = await this.agent.ask(query);
    const trace = mapAskResponseToTrace(response);

    return {
      answer: response.finalAnswer,
      trace,
    };
  }

  /**
   * Search for objects without generating an answer
   *
   * @param message - The search query
   * @returns Raw search results with trace
   */
  async search(message: string): Promise<QueryAgentSearchResponse> {
    return this.agent.search(message);
  }

  /**
   * Stream tokens from the agent response (stub for future implementation)
   *
   * @param message - The question to stream
   * @param chatHistory - Optional chat history
   * @returns AsyncGenerator yielding streamed tokens only (filters out progress messages)
   */
  async *stream(
    message: string,
    chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): AsyncGenerator<QueryAgentStreamChunk> {
    const query: QueryAgentChatMessage[] | string = chatHistory
      ? [...mapChatHistory(chatHistory), { role: 'user', content: message }]
      : message;

    for await (const chunk of this.agent.askStream(query, {
      includeFinalState: false,
    })) {
      // Only yield StreamedTokens, filter out ProgressMessage
      if (chunk.outputType === 'streamedTokens') {
        yield chunk;
      }
    }
  }
}
