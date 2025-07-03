module.exports = {
  editor: {
    create: jest.fn(() => ({
      getValue: jest.fn(() => ''),
      setValue: jest.fn(),
      onDidChangeModelContent: jest.fn(),
      dispose: jest.fn()
    }))
  }
}; 