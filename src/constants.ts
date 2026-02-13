import packageJson from '../package.json';

/**
 * Custom header for identifying Weaviate Studio client
 * Format: weaviate-client-typescript/weaviate-studio@{version}
 */
export const WEAVIATE_CLIENT_HEADER = `weaviate-client-typescript/weaviate-studio@${packageJson.version}`;
