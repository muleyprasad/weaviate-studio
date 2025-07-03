import '@testing-library/jest-dom';

// Extend default timeout for integration tests if needed
jest.setTimeout(30000);

// Module path mapping in jest.config.js will redirect VS Code, Monaco and Weaviate imports
// so we don't need additional setup code here, but we keep the file for future global hooks. 