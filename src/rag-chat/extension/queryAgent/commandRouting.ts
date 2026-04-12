/**
 * Command routing logic for Query Agent
 * Parses slash commands and determines which SDK method to call
 */

export interface ParsedCommand {
  method: 'ask' | 'search';
  cleanMessage: string;
  command: string | null;
}

/**
 * Parse a user message and determine routing
 * - /search → search() method (pure retrieval, 1 WCD request)
 * - /ask, /explore, /fetch, /query → ask() method (4 WCD requests)
 * - /collections → ask("List the available collections")
 * - Plain text → ask() method
 *
 * Command prefix is stripped before returning cleanMessage.
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();

  // No command prefix — treat as plain ask()
  if (!trimmed.startsWith('/')) {
    return {
      method: 'ask',
      cleanMessage: trimmed,
      command: null,
    };
  }

  // Extract command (first word after /)
  const match = trimmed.match(/^\/(\w+)\s*(.*)/);
  if (!match) {
    // Malformed — treat as plain ask()
    return {
      method: 'ask',
      cleanMessage: trimmed,
      command: null,
    };
  }

  const command = match[1];
  const args = match[2];

  // Special case: /collections → ask with predefined message
  if (command === 'collections') {
    return {
      method: 'ask',
      cleanMessage: 'List the available collections',
      command: '/collections',
    };
  }

  // /search is the only pure retrieval command
  if (command === 'search') {
    return {
      method: 'search',
      cleanMessage: args,
      command: '/search',
    };
  }

  // All other commands (/ask, /explore, /fetch, /query) → ask()
  if (['ask', 'explore', 'fetch', 'query'].includes(command)) {
    return {
      method: 'ask',
      cleanMessage: args,
      command: `/${command}`,
    };
  }

  // Unknown command — treat as plain ask()
  return {
    method: 'ask',
    cleanMessage: trimmed,
    command: null,
  };
}
