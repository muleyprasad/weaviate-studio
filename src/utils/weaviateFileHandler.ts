import * as vscode from 'vscode';
import { WeaviateConnection } from '../services/ConnectionManager';

/**
 * Validates if a JSON object is a valid Weaviate connection
 */
export function isValidWeaviateConnection(obj: any): obj is Omit<WeaviateConnection, 'id' | 'status'> {
    if (!obj || typeof obj !== 'object') {
        return false;
    }

    // Check required fields
    if (!obj.name || typeof obj.name !== 'string' || obj.name.trim() === '') {
        return false;
    }

    if (!obj.type || (obj.type !== 'custom' && obj.type !== 'cloud')) {
        return false;
    }

    // Validate type-specific required fields
    if (obj.type === 'custom') {
        if (!obj.httpHost || typeof obj.httpHost !== 'string' || obj.httpHost.trim() === '') {
            return false;
        }
    } else if (obj.type === 'cloud') {
        if (!obj.cloudUrl || typeof obj.cloudUrl !== 'string' || obj.cloudUrl.trim() === '') {
            return false;
        }
        if (!obj.apiKey || typeof obj.apiKey !== 'string' || obj.apiKey.trim() === '') {
            return false;
        }
    }

    return true;
}

/**
 * Parses and validates a .weaviate file content
 */
export function parseWeaviateFile(content: string): { 
    isValid: boolean; 
    connectionData?: Omit<WeaviateConnection, 'id' | 'status'>; 
    error?: string 
} {
    try {
        const connectionData = JSON.parse(content);
        
        if (!isValidWeaviateConnection(connectionData)) {
            return {
                isValid: false,
                error: 'Invalid connection configuration'
            };
        }

        return {
            isValid: true,
            connectionData
        };
    } catch (parseError) {
        return {
            isValid: false,
            error: 'Invalid JSON format'
        };
    }
}

/**
 * Generates a unique connection name by appending a counter
 */
export function generateUniqueConnectionName(baseName: string, existingNames: string[]): string {
    const existingNamesLower = existingNames.map(name => name.toLowerCase());
    
    if (!existingNamesLower.includes(baseName.toLowerCase())) {
        return baseName;
    }

    let counter = 2; // Start from 2 since baseName already exists
    let newName = `${baseName} (${counter})`;
    while (existingNamesLower.includes(newName.toLowerCase())) {
        counter++;
        newName = `${baseName} (${counter})`;
    }
    return newName;
}