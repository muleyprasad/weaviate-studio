import { formatGraphQLQuery } from '../formatGraphQL';

// Mock Prettier standalone
const mockFormat = jest.fn().mockResolvedValue('formatted');
jest.mock('prettier/standalone', () => ({
  format: (...args: any[]) => mockFormat(...args),
}));

// Mock parser (not used by logic but imported)
jest.mock('prettier/parser-graphql', () => ({}));

describe('formatGraphQLQuery', () => {
  beforeEach(() => {
    mockFormat.mockClear();
  });

  it('calls prettier.format with graphql parser and returns formatted string', async () => {
    const input = '{get{obj{_additional{id}}}}';
    const result = await formatGraphQLQuery(input);
    expect(mockFormat).toHaveBeenCalledTimes(1);
    const callArgs = mockFormat.mock.calls[0][0];
    expect(callArgs).toBe(input);
    const options = mockFormat.mock.calls[0][1];
    expect(options.parser).toBe('graphql');
    expect(result).toBe('formatted');
  });

  it('returns original query when prettier throws', async () => {
    // Mock console.error para evitar logs no teste
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    mockFormat.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const input = '{bad}';
    const result = await formatGraphQLQuery(input);
    expect(result).toBe(input);

    // Verifica que o error foi logado
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error formatting GraphQL query:',
      expect.any(Error)
    );

    // Limpa o spy
    consoleErrorSpy.mockRestore();
  });
});
