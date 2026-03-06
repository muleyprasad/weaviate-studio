/**
 * RAG Chat TypeScript Types
 * Defines interfaces for RAG (Retrieval-Augmented Generation) chat queries,
 * responses, history, and extension <-> webview communication
 */

// =====================================================
// RAG Query & Response Types
// =====================================================

/**
 * Query sent to Weaviate for RAG (Retrieval-Augmented Generation)
 */
export interface RagChatQuery {
  /** Collection names to search (array for future multi-collection support; v1 uses single) */
  collectionNames: string[];
  /** The natural language question to ask */
  question: string;
  /** How many objects to retrieve for context (default: 5) */
  limit?: number;
}

/**
 * A single retrieved context object from the vector search
 */
export interface RagContextObject {
  /** Weaviate object UUID */
  uuid: string;
  /** Object properties */
  properties: Record<string, unknown>;
  /** Distance score from vector search */
  distance?: number;
  /** Certainty score from vector search */
  certainty?: number;
}

/**
 * Response from a RAG query
 */
export interface RagChatResponse {
  /** The generated answer from the LLM */
  answer: string;
  /** Retrieved context objects used to generate the answer */
  contextObjects: RagContextObject[];
  /** The original query that produced this response */
  query: RagChatQuery;
  /** Unix timestamp of when the response was received */
  timestamp: number;
}

// =====================================================
// Chat History Types
// =====================================================

/**
 * A single entry in the RAG chat history
 */
export interface RagChatHistoryEntry {
  /** Unique identifier for this history entry */
  id: string;
  /** The query that was sent */
  query: RagChatQuery;
  /** The response received (null if still loading or errored) */
  response: RagChatResponse | null;
  /** Error message if the query failed */
  error: string | null;
  /** Whether the query is currently in progress */
  loading: boolean;
  /** Unix timestamp of when the query was initiated */
  timestamp: number;
}

// =====================================================
// Extension <-> Webview Message Types
// =====================================================

/**
 * Commands sent from the extension to the webview
 */
export type RagChatExtensionMessageCommand =
  | 'init'
  | 'ragResponse'
  | 'ragError'
  | 'collectionsLoaded';

/**
 * Message sent from the extension to the webview
 */
export interface RagChatExtensionMessage {
  command: RagChatExtensionMessageCommand;
  /** Collection names available for RAG queries */
  collectionNames?: string[];
  /** The user's original question */
  question?: string;
  /** The generated answer from the LLM */
  answer?: string;
  /** Retrieved context objects */
  contextObjects?: RagContextObject[];
  /** Error message */
  error?: string;
  /** Request ID to match responses with requests */
  requestId?: string;
}

/**
 * Commands sent from the webview to the extension
 */
export type RagChatWebviewMessageCommand = 'initialize' | 'executeRagQuery' | 'getCollections';

/**
 * Message sent from the webview to the extension
 */
export interface RagChatWebviewMessage {
  command: RagChatWebviewMessageCommand;
  /** Collection names to query */
  collectionNames?: string[];
  /** The natural language question */
  question?: string;
  /** How many objects to retrieve for context */
  limit?: number;
  /** Request ID for tracking */
  requestId?: string;
}

// =====================================================
// VS Code API Type (RAG Chat)
// =====================================================

/**
 * VS Code API interface for the RAG Chat webview
 */
export interface RagChatVSCodeAPI {
  postMessage: (message: RagChatWebviewMessage) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}
