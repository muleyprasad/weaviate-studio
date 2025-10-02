import { jest } from '@jest/globals';
import { ConnectionManager, ConnectionLink } from '../ConnectionManager';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => require('../../test/mocks/vscode'), { virtual: true });

describe('ConnectionManager - Links functionality', () => {
    let connectionManager: ConnectionManager;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockContext = {
            globalState: {
                get: jest.fn().mockReturnValue([]),
                update: jest.fn()
            },
            workspaceState: {
                get: jest.fn(),
                update: jest.fn()
            }
        } as any;

        connectionManager = ConnectionManager.getInstance(mockContext);
    });

    afterEach(() => {
        // Clear the singleton instance
        (ConnectionManager as any).instance = undefined;
    });

    describe('Connection Links Management', () => {
        it('should add a link to an existing connection', async () => {
            // Add a test connection first
            const connection = await connectionManager.addConnection({
                name: 'Test Connection',
                type: 'custom',
                httpHost: 'localhost',
                httpPort: 8080
            });

            const link: ConnectionLink = {
                name: 'Documentation',
                url: 'https://weaviate.io/docs'
            };

            await connectionManager.addConnectionLink(connection.id, link);

            const updatedConnection = connectionManager.getConnection(connection.id);
            expect(updatedConnection?.links).toHaveLength(1);
            expect(updatedConnection?.links?.[0]).toEqual(link);
        });

        it('should throw error when adding link to non-existent connection', async () => {
            const link: ConnectionLink = {
                name: 'Documentation',
                url: 'https://weaviate.io/docs'
            };

            await expect(connectionManager.addConnectionLink('non-existent', link))
                .rejects.toThrow('Connection not found');
        });

        it('should update an existing link', async () => {
            // Add a test connection with a link
            const connection = await connectionManager.addConnection({
                name: 'Test Connection',
                type: 'custom',
                httpHost: 'localhost',
                httpPort: 8080,
                links: [{
                    name: 'Original',
                    url: 'https://original.com'
                }]
            });

            const updatedLink: ConnectionLink = {
                name: 'Updated Documentation',
                url: 'https://updated-docs.com'
            };

            await connectionManager.updateConnectionLink(connection.id, 0, updatedLink);

            const updatedConnection = connectionManager.getConnection(connection.id);
            expect(updatedConnection?.links?.[0]).toEqual(updatedLink);
        });

        it('should throw error when updating link with invalid index', async () => {
            // Add a test connection
            const connection = await connectionManager.addConnection({
                name: 'Test Connection',
                type: 'custom',
                httpHost: 'localhost',
                httpPort: 8080
            });

            const updatedLink: ConnectionLink = {
                name: 'Updated',
                url: 'https://updated.com'
            };

            await expect(connectionManager.updateConnectionLink(connection.id, 0, updatedLink))
                .rejects.toThrow('Link not found');
        });

        it('should remove a link from connection', async () => {
            // Add a test connection with links
            const connection = await connectionManager.addConnection({
                name: 'Test Connection',
                type: 'custom',
                httpHost: 'localhost',
                httpPort: 8080,
                links: [
                    { name: 'Link1', url: 'https://link1.com' },
                    { name: 'Link2', url: 'https://link2.com' }
                ]
            });

            await connectionManager.removeConnectionLink(connection.id, 0);

            const updatedConnection = connectionManager.getConnection(connection.id);
            expect(updatedConnection?.links).toHaveLength(1);
            expect(updatedConnection?.links?.[0].name).toBe('Link2');
        });

        it('should get all links for a connection', async () => {
            // Add a test connection with links
            const connection = await connectionManager.addConnection({
                name: 'Test Connection',
                type: 'custom',
                httpHost: 'localhost',
                httpPort: 8080,
                links: [
                    { name: 'Link1', url: 'https://link1.com' },
                    { name: 'Link2', url: 'https://link2.com' }
                ]
            });

            const links = connectionManager.getConnectionLinks(connection.id);
            expect(links).toHaveLength(2);
            expect(links[0].name).toBe('Link1');
            expect(links[1].name).toBe('Link2');
        });

        it('should return empty array for connection with no links', async () => {
            // Add a test connection without links
            const connection = await connectionManager.addConnection({
                name: 'Test Connection',
                type: 'custom',
                httpHost: 'localhost',
                httpPort: 8080
            });

            const links = connectionManager.getConnectionLinks(connection.id);
            expect(links).toHaveLength(0);
        });

        it('should throw error when getting links for non-existent connection', () => {
            expect(() => connectionManager.getConnectionLinks('non-existent'))
                .toThrow('Connection not found');
        });
    });
});