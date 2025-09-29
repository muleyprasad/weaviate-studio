import { isValidWeaviateConnection, parseWeaviateFile, generateUniqueConnectionName } from '../utils/weaviateFileHandler';

describe('Weaviate File Handler', () => {
    // Mock connection data for testing
    const validCustomConnection = {
        name: 'Test Custom Connection',
        type: 'custom' as const,
        httpHost: 'localhost',
        httpPort: 8080,
        httpSecure: false,
        grpcHost: 'localhost',
        grpcPort: 50051,
        grpcSecure: false,
        connectionVersion: '2'
    };

    const validCloudConnection = {
        name: 'Test Cloud Connection',
        type: 'cloud' as const,
        cloudUrl: 'https://test-cluster.weaviate.network',
        apiKey: 'test-api-key',
        connectionVersion: '2'
    };

    const minimalCustomConnection = {
        name: 'Minimal Custom',
        type: 'custom' as const,
        httpHost: 'localhost'
    };

    const minimalCloudConnection = {
        name: 'Minimal Cloud',
        type: 'cloud' as const,
        cloudUrl: 'https://cluster.weaviate.network',
        apiKey: 'key123'
    };

    describe('isValidWeaviateConnection', () => {
        test('should validate complete custom connection', () => {
            expect(isValidWeaviateConnection(validCustomConnection)).toBe(true);
        });

        test('should validate complete cloud connection', () => {
            expect(isValidWeaviateConnection(validCloudConnection)).toBe(true);
        });

        test('should validate minimal custom connection', () => {
            expect(isValidWeaviateConnection(minimalCustomConnection)).toBe(true);
        });

        test('should validate minimal cloud connection', () => {
            expect(isValidWeaviateConnection(minimalCloudConnection)).toBe(true);
        });

        test('should reject null/undefined', () => {
            expect(isValidWeaviateConnection(null)).toBe(false);
            expect(isValidWeaviateConnection(undefined)).toBe(false);
        });

        test('should reject non-objects', () => {
            expect(isValidWeaviateConnection('string')).toBe(false);
            expect(isValidWeaviateConnection(123)).toBe(false);
            expect(isValidWeaviateConnection([])).toBe(false);
        });

        test('should reject connections without name', () => {
            expect(isValidWeaviateConnection({ type: 'custom', httpHost: 'localhost' })).toBe(false);
            expect(isValidWeaviateConnection({ name: '', type: 'custom', httpHost: 'localhost' })).toBe(false);
            expect(isValidWeaviateConnection({ name: '   ', type: 'custom', httpHost: 'localhost' })).toBe(false);
        });

        test('should reject connections without type', () => {
            expect(isValidWeaviateConnection({ name: 'Test', httpHost: 'localhost' })).toBe(false);
        });

        test('should reject connections with invalid type', () => {
            expect(isValidWeaviateConnection({ name: 'Test', type: 'invalid', httpHost: 'localhost' })).toBe(false);
        });

        test('should reject custom connections without httpHost', () => {
            expect(isValidWeaviateConnection({ name: 'Test', type: 'custom' })).toBe(false);
            expect(isValidWeaviateConnection({ name: 'Test', type: 'custom', httpHost: '' })).toBe(false);
            expect(isValidWeaviateConnection({ name: 'Test', type: 'custom', httpHost: '   ' })).toBe(false);
        });

        test('should reject cloud connections without cloudUrl', () => {
            expect(isValidWeaviateConnection({ name: 'Test', type: 'cloud', apiKey: 'key' })).toBe(false);
            expect(isValidWeaviateConnection({ name: 'Test', type: 'cloud', cloudUrl: '', apiKey: 'key' })).toBe(false);
        });

        test('should reject cloud connections without apiKey', () => {
            expect(isValidWeaviateConnection({ name: 'Test', type: 'cloud', cloudUrl: 'url' })).toBe(false);
            expect(isValidWeaviateConnection({ name: 'Test', type: 'cloud', cloudUrl: 'url', apiKey: '' })).toBe(false);
        });
    });

    describe('parseWeaviateFile', () => {
        test('should parse valid custom connection JSON', () => {
            const jsonString = JSON.stringify(validCustomConnection);
            const result = parseWeaviateFile(jsonString);
            
            expect(result.isValid).toBe(true);
            expect(result.connectionData).toEqual(validCustomConnection);
            expect(result.error).toBeUndefined();
        });

        test('should parse valid cloud connection JSON', () => {
            const jsonString = JSON.stringify(validCloudConnection);
            const result = parseWeaviateFile(jsonString);
            
            expect(result.isValid).toBe(true);
            expect(result.connectionData).toEqual(validCloudConnection);
            expect(result.error).toBeUndefined();
        });

        test('should handle invalid JSON', () => {
            const result = parseWeaviateFile('{ invalid json }');
            
            expect(result.isValid).toBe(false);
            expect(result.connectionData).toBeUndefined();
            expect(result.error).toBe('Invalid JSON format');
        });

        test('should handle valid JSON with invalid connection', () => {
            const invalidJson = JSON.stringify({ name: '', type: 'invalid' });
            const result = parseWeaviateFile(invalidJson);
            
            expect(result.isValid).toBe(false);
            expect(result.connectionData).toBeUndefined();
            expect(result.error).toBe('Invalid connection configuration');
        });

        test('should handle empty string', () => {
            const result = parseWeaviateFile('');
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Invalid JSON format');
        });
    });

    describe('generateUniqueConnectionName', () => {
        test('should return original name if not in existing names', () => {
            const result = generateUniqueConnectionName('New Connection', ['Other Connection', 'Another One']);
            expect(result).toBe('New Connection');
        });

        test('should return original name if existing names is empty', () => {
            const result = generateUniqueConnectionName('New Connection', []);
            expect(result).toBe('New Connection');
        });

        test('should add (2) suffix for first duplicate', () => {
            const result = generateUniqueConnectionName('Test Connection', ['Test Connection']);
            expect(result).toBe('Test Connection (2)');
        });

        test('should increment counter for multiple duplicates', () => {
            const existingNames = ['Test Connection', 'Test Connection (2)', 'Test Connection (3)'];
            const result = generateUniqueConnectionName('Test Connection', existingNames);
            expect(result).toBe('Test Connection (4)');
        });

        test('should be case-insensitive', () => {
            const result = generateUniqueConnectionName('Test Connection', ['test connection', 'TEST CONNECTION (2)']);
            expect(result).toBe('Test Connection (3)');
        });

        test('should handle non-sequential duplicates', () => {
            const existingNames = ['Test Connection', 'Test Connection (2)', 'Test Connection (5)'];
            const result = generateUniqueConnectionName('Test Connection', existingNames);
            expect(result).toBe('Test Connection (3)');
        });

        test('should work with empty base name', () => {
            const result = generateUniqueConnectionName('', ['']);
            expect(result).toBe(' (2)');
        });
    });
});