import '@testing-library/jest-dom';

// Extend default timeout for integration tests if needed
jest.setTimeout(30000);

// Suppress console warnings during tests to reduce noise in test output
// while still preserving error logs that might indicate real issues
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  // Only suppress specific warnings that are expected during tests
  const message = args[0];
  if (typeof message === 'string' && message.includes('Connection name conflict:')) {
    return; // Suppress connection name conflict warnings
  }
  // Let other warnings through
  originalWarn.apply(console, args);
};

// Module path mapping in jest.config.js will redirect VS Code, Monaco and Weaviate imports
// so we don't need additional setup code here, but we keep the file for future global hooks. 