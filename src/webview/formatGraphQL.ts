import * as prettier from 'prettier/standalone';
import * as graphqlParser from 'prettier/parser-graphql';

/**
 * Format a GraphQL query string using Prettier
 * @param query The GraphQL query string to format
 * @returns Formatted GraphQL query string
 */
export const formatGraphQLQuery = async (query: string): Promise<string> => {
  try {
    const formattedQuery = await prettier.format(query, {
      parser: 'graphql',
      plugins: [graphqlParser],
      printWidth: 80,
      tabWidth: 2,
    });

    return formattedQuery;
  } catch (error) {
    console.error('Error formatting GraphQL query:', error);
    return query; // Return the original query if formatting fails
  }
};
