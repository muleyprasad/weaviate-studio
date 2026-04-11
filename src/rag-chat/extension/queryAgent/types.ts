// @ts-nocheck

/**
 * Query Agent SDK Type Aliases
 *
 * This file serves as the single source of truth for all Query Agent type imports.
 * Every other module in the codebase depends on these re-exports, not directly on
 * weaviate-agents SDK types. This enables painless SDK updates and maintains
 * consistency across the codebase.
 *
 * Verified SDK Field Paths (as of weaviate-agents package installation):
 * - QueryAgent class: src/weaviate-agents/dist/query/agent.d.ts
 * - AskModeResponse: src/weaviate-agents/dist/query/response/response.d.ts lines 2-13
 *   Fields: outputType, searches, aggregations, usage, totalTime, isPartialAnswer,
 *   missingInformation, finalAnswer, sources, display()
 * - SearchModeResponse: src/weaviate-agents/dist/query/response/response.d.ts lines 272-278
 *   Fields: searches, usage, totalTime, searchResults, next()
 * - StreamedTokens: src/weaviate-agents/dist/query/response/response.d.ts lines 255-258
 *   Fields: outputType, delta
 * - ChatMessage: src/weaviate-agents/dist/query/agent.d.ts lines 108-111
 *   Fields: role ('user' | 'assistant'), content
 * - ProgressMessage: src/weaviate-agents/dist/query/response/response.d.ts lines 249-254
 *   Fields: outputType, stage, message, details
 */

export {
  QueryAgent,
  type QueryAgentOptions,
  type QueryAgentQuery,
  type ChatMessage as QueryAgentChatMessage,
  type QueryAgentAskOptions,
  type QueryAgentAskStreamOptions,
  type QueryAgentSearchOnlyOptions,
} from 'weaviate-agents';

export {
  type AskModeResponse as QueryAgentAskResponse,
  type SearchModeResponse as QueryAgentSearchResponse,
  type StreamedTokens as QueryAgentStreamChunk,
  type ProgressMessage as QueryAgentProgressMessage,
  type Source as QueryAgentSource,
  type Search as QueryAgentSearch,
  type Aggregation as QueryAgentAggregation,
  type ModelUnitUsage as QueryAgentUsage,
} from 'weaviate-agents';

import type { ModelUnitUsage, Source } from 'weaviate-agents';

/**
 * Combined trace response type that includes both the final answer and metadata.
 * Used by the webview to render "How this was answered" disclosure panels.
 */
export type QueryAgentTrace = {
  searches: Array<{
    query?: string;
    collection: string;
  }>;
  aggregations: Array<{
    collection: string;
    groupbyProperty?: string;
  }>;
  usage: ModelUnitUsage;
  totalTime: number;
  sources?: Source[];
  collectionNames: string[];
  isPartialAnswer?: boolean;
  missingInformation?: string[];
};
