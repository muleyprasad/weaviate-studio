import packageJson from '../package.json';

/**
 * Integration header for identifying Weaviate Studio
 * Format: weaviate-studio/{version}
 */
export const WEAVIATE_INTEGRATION_HEADER = `weaviate-studio/${packageJson.version}`;
