/**
 * Tests for command routing logic
 */

import { parseCommand } from '../commandRouting';

describe('parseCommand', () => {
  describe('/search command', () => {
    it('should route /search to search() with stripped prefix', () => {
      const result = parseCommand('/search wireless headphones');
      expect(result).toEqual({
        method: 'search',
        cleanMessage: 'wireless headphones',
        command: '/search',
      });
    });

    it('should handle /search with no arguments', () => {
      const result = parseCommand('/search');
      expect(result).toEqual({
        method: 'search',
        cleanMessage: '',
        command: '/search',
      });
    });

    it('should handle /search with extra whitespace', () => {
      const result = parseCommand('/search   multiple words');
      expect(result).toEqual({
        method: 'search',
        cleanMessage: 'multiple words',
        command: '/search',
      });
    });
  });

  describe('/ask command', () => {
    it('should route /ask to ask() with stripped prefix', () => {
      const result = parseCommand('/ask what are the top products');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: 'what are the top products',
        command: '/ask',
      });
    });

    it('should handle /ask with no arguments', () => {
      const result = parseCommand('/ask');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: '',
        command: '/ask',
      });
    });
  });

  describe('/explore command', () => {
    it('should route /explore to ask()', () => {
      const result = parseCommand('/explore similar items');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: 'similar items',
        command: '/explore',
      });
    });
  });

  describe('/fetch command', () => {
    it('should route /fetch to ask() with stripped prefix', () => {
      const result = parseCommand('/fetch id:"uuid-123"');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: 'id:"uuid-123"',
        command: '/fetch',
      });
    });
  });

  describe('/query command', () => {
    it('should route /query to ask()', () => {
      const result = parseCommand('/query some query');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: 'some query',
        command: '/query',
      });
    });
  });

  describe('/collections command', () => {
    it('should route /collections to ask() with predefined message', () => {
      const result = parseCommand('/collections');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: 'List the available collections',
        command: '/collections',
      });
    });

    it('should ignore arguments after /collections', () => {
      const result = parseCommand('/collections ignored args');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: 'List the available collections',
        command: '/collections',
      });
    });
  });

  describe('Plain text (no command)', () => {
    it('should route plain text to ask()', () => {
      const result = parseCommand('what are the top products');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: 'what are the top products',
        command: null,
      });
    });

    it('should handle empty string', () => {
      const result = parseCommand('');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: '',
        command: null,
      });
    });

    it('should handle whitespace only', () => {
      const result = parseCommand('   ');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: '',
        command: null,
      });
    });

    it('should treat text starting with / mid-string as plain text', () => {
      const result = parseCommand('check /search results');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: 'check /search results',
        command: null,
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle unknown commands as plain ask()', () => {
      const result = parseCommand('/unknown-command something');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: '/unknown-command something',
        command: null,
      });
    });

    it('should handle command with special characters in arguments', () => {
      const result = parseCommand('/search product:laptop AND price<1000');
      expect(result).toEqual({
        method: 'search',
        cleanMessage: 'product:laptop AND price<1000',
        command: '/search',
      });
    });

    it('should handle commands with mixed case as lowercase only', () => {
      // Commands must be lowercase to match
      const result = parseCommand('/SEARCH items');
      expect(result).toEqual({
        method: 'ask',
        cleanMessage: '/SEARCH items',
        command: null,
      });
    });
  });
});
