/**
 * Tests for RagChatPanel message handling logic.
 *
 * The multi-collection merge and input-validation logic is tested here
 * by importing the pure functions extracted into utils.ts. If the production
 * algorithm changes, these tests will break immediately.
 */

// ─── Vscode mock ──────────────────────────────────────────────────────
jest.mock('vscode', () => ({
  window: {
    createWebviewPanel: jest.fn(),
    activeTextEditor: undefined,
    ViewColumn: { One: 1 },
  },
  Uri: {
    joinPath: jest.fn().mockImplementation((_base: any, ...parts: string[]) => ({
      fsPath: '/' + parts.join('/'),
    })),
  },
  EventEmitter: jest.fn(),
}));

import {
  mergeSettledResults,
  validateRagQueryInput,
  SettledQueryResult,
} from '../rag-chat/extension/utils';

// ─── Tests ────────────────────────────────────────────────────────────

describe('RagChatPanel — multi-collection merge logic', () => {
  describe('answer formatting', () => {
    it('returns raw answer for single collection (no heading prefix)', () => {
      const settled: PromiseSettledResult<SettledQueryResult>[] = [
        {
          status: 'fulfilled',
          value: { collectionName: 'ColA', answer: 'The answer.', contextObjects: [] },
        },
      ];

      const { answer } = mergeSettledResults(settled, ['ColA']);
      expect(answer).toBe('The answer.');
      expect(answer).not.toContain('### From');
    });

    it('prefixes answers with collection headers for multiple collections', () => {
      const settled: PromiseSettledResult<SettledQueryResult>[] = [
        {
          status: 'fulfilled',
          value: { collectionName: 'ColA', answer: 'Answer A.', contextObjects: [] },
        },
        {
          status: 'fulfilled',
          value: { collectionName: 'ColB', answer: 'Answer B.', contextObjects: [] },
        },
      ];

      const { answer } = mergeSettledResults(settled, ['ColA', 'ColB']);
      expect(answer).toContain('### From ColA');
      expect(answer).toContain('Answer A.');
      expect(answer).toContain('### From ColB');
      expect(answer).toContain('Answer B.');
      expect(answer).toContain('---');
    });
  });

  describe('context object attribution', () => {
    it('stamps collectionName from the result onto each context object', () => {
      const settled: PromiseSettledResult<SettledQueryResult>[] = [
        {
          status: 'fulfilled',
          value: {
            collectionName: 'ColA',
            answer: 'A',
            contextObjects: [{ uuid: 'uuid-1', properties: { text: 'hi' }, score: 0.9 }],
          },
        },
      ];

      const { contextObjects } = mergeSettledResults(settled, ['ColA']);
      expect(contextObjects[0].collectionName).toBe('ColA');
      expect(contextObjects[0].uuid).toBe('uuid-1');
      expect(contextObjects[0].score).toBe(0.9);
    });

    it('merges context objects from multiple collections with correct attribution', () => {
      const settled: PromiseSettledResult<SettledQueryResult>[] = [
        {
          status: 'fulfilled',
          value: {
            collectionName: 'ColA',
            answer: 'A',
            contextObjects: [{ uuid: 'uuid-a', properties: {} }],
          },
        },
        {
          status: 'fulfilled',
          value: {
            collectionName: 'ColB',
            answer: 'B',
            contextObjects: [{ uuid: 'uuid-b', properties: {} }],
          },
        },
      ];

      const { contextObjects } = mergeSettledResults(settled, ['ColA', 'ColB']);
      expect(contextObjects).toHaveLength(2);
      expect(contextObjects.find((o) => o.uuid === 'uuid-a')?.collectionName).toBe('ColA');
      expect(contextObjects.find((o) => o.uuid === 'uuid-b')?.collectionName).toBe('ColB');
    });
  });

  describe('hasError / allFailed flag', () => {
    it('allFailed is false when all queries succeed', () => {
      const settled: PromiseSettledResult<SettledQueryResult>[] = [
        {
          status: 'fulfilled',
          value: { collectionName: 'ColA', answer: 'ok', contextObjects: [] },
        },
      ];

      const { allFailed } = mergeSettledResults(settled, ['ColA']);
      expect(allFailed).toBe(false);
    });

    it('allFailed is true when ALL queries fail', () => {
      const settled: PromiseSettledResult<SettledQueryResult>[] = [
        { status: 'rejected', reason: new Error('fail A') },
        { status: 'rejected', reason: new Error('fail B') },
      ];

      const { allFailed } = mergeSettledResults(settled, ['ColA', 'ColB']);
      expect(allFailed).toBe(true);
    });

    it('allFailed is false when only SOME queries fail (partial success)', () => {
      const settled: PromiseSettledResult<SettledQueryResult>[] = [
        {
          status: 'fulfilled',
          value: { collectionName: 'ColA', answer: 'ok', contextObjects: [] },
        },
        { status: 'rejected', reason: new Error('ColB failed') },
      ];

      const { allFailed } = mergeSettledResults(settled, ['ColA', 'ColB']);
      expect(allFailed).toBe(false);
    });

    it('includes error message in answer for failed collections', () => {
      const settled: PromiseSettledResult<SettledQueryResult>[] = [
        { status: 'rejected', reason: new Error('timeout') },
      ];

      const { answer } = mergeSettledResults(settled, ['ColA']);
      expect(answer).toContain('⚠️ Query failed for "ColA"');
      expect(answer).toContain('timeout');
    });

    it('handles non-Error rejection reason correctly', () => {
      const settled: PromiseSettledResult<SettledQueryResult>[] = [
        { status: 'rejected', reason: 'string error' },
      ];

      const { answer } = mergeSettledResults(settled, ['ColA']);
      expect(answer).toContain('string error');
    });
  });

  describe('input validation — validateRagQueryInput', () => {
    it('returns "no_collections" when collectionNames is empty', () => {
      expect(validateRagQueryInput([], 'any question')).toBe('no_collections');
    });

    it('returns "empty_question" when question is an empty string', () => {
      expect(validateRagQueryInput(['ColA'], '')).toBe('empty_question');
    });

    it('returns "empty_question" when question is whitespace only', () => {
      expect(validateRagQueryInput(['ColA'], '   ')).toBe('empty_question');
    });

    it('returns "empty_question" when question is undefined', () => {
      expect(validateRagQueryInput(['ColA'], undefined)).toBe('empty_question');
    });

    it('returns null for valid inputs (no error)', () => {
      expect(validateRagQueryInput(['ColA'], 'What is this?')).toBeNull();
    });

    it('prioritises no_collections over empty_question', () => {
      // Both are invalid; the function checks collections first
      expect(validateRagQueryInput([], '')).toBe('no_collections');
    });
  });
});
