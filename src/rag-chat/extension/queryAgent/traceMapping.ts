/**
 * Trace Mapping Utilities
 *
 * Converts weaviate-agents SDK response types to internal trace format for webview rendering
 */

import type { QueryAgentAskResponse, QueryAgentChatMessage, QueryAgentTrace } from './types';

/**
 * Maps a QueryAgent .ask() response to our internal QueryAgentTrace type
 *
 * Extracts:
 * - searches: Array of { query?, collection }
 * - aggregations: Array of { collection, groupbyProperty? }
 * - usage: Token/model unit usage
 * - totalTime: Query execution time
 * - sources: Objects cited in the answer
 * - collectionNames: All collections touched
 * - isPartialAnswer: Whether the answer is incomplete
 * - missingInformation: What the agent couldn't find
 *
 * @param response - Raw AskModeResponse from weaviate-agents
 * @returns QueryAgentTrace for webview rendering
 */
export function mapAskResponseToTrace(response: QueryAgentAskResponse): QueryAgentTrace {
  return {
    searches: response.searches.map((search) => ({
      query: search.query,
      collection: search.collection,
    })),
    aggregations: response.aggregations.map((agg) => ({
      collection: agg.collection,
      groupbyProperty: agg.groupbyProperty,
    })),
    usage: response.usage,
    totalTime: response.totalTime,
    sources: response.sources,
    collectionNames: response.searches.map((s) => s.collection),
    isPartialAnswer: response.isPartialAnswer,
    missingInformation: response.missingInformation,
  };
}

/**
 * Maps internal chat history messages to weaviate-agents QueryAgentChatMessage[] format
 *
 * Strips each message to { role, content } only, matching SDK expectations
 *
 * @param messages - Chat messages with role and content
 * @returns Array of QueryAgentChatMessage (role + content only)
 */
export function mapChatHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): QueryAgentChatMessage[] {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}
