module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '^monaco-editor$': '<rootDir>/src/test/mocks/monaco-editor.ts',
    '^vscode$': '<rootDir>/src/test/mocks/vscode.ts',
    '^weaviate-ts-client$': '<rootDir>/src/test/mocks/weaviate-client.ts'
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)', '**/?(*.)+(test).(ts|tsx)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  }
}; 