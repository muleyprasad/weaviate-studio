import * as vscode from 'vscode';
import { WeaviateConnection } from '../services/ConnectionManager';
import { CollectionConfig, Node } from 'weaviate-client';

// Extended schema interfaces to include vector-related fields
export interface ExtendedSchemaProperty extends SchemaProperty {
    vectorizer?: string;
    vectorizerConfig?: {
        vectorizer?: {
            vectorizePropertyName?: boolean;
            [key: string]: any;
        };
        [key: string]: any;
    };
    vectorDimensions?: number;
    moduleConfig?: {
        vectorizer?: {
            [key: string]: any;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

export interface ExtendedSchemaClass extends SchemaClass {
    properties?: ExtendedSchemaProperty[];
    [key: string]: any;
}

/**
 * Represents a property in a Weaviate schema
 */
export interface SchemaProperty {
    name: string;
    dataType: string[];
    description?: string;
    indexInverted?: boolean;
    tokenization?: string;
    indexFilterable?: boolean;
    indexSearchable?: boolean;
    indexRangeFilters?: boolean;
    moduleConfig?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * Represents a class/collection in a Weaviate schema
 */
export interface SchemaClass {
    class: string;
    description?: string;
    properties?: SchemaProperty[];
    vectorizer?: string;
    moduleConfig?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface WeaviateMetadata {
        /**
         * Format: url
         * @description The url of the host.
         */
        hostname?: string;
        /** @description The Weaviate server version. */
        version?: string;
        /** @description Module-specific meta information. */
        modules?: {
            [key: string]: unknown;
        };
        /** @description Max message size for GRPC connection in bytes. */
        grpcMaxMessageSize?: number;
    }

/**
 * Extends WeaviateTreeItem to include schema information
 */
export interface CollectionWithSchema extends WeaviateTreeItem {
    schema?: CollectionConfig;
    nodes?: Node<"verbose">[];
    metaData?: WeaviateMetadata;
}

/**
 * Maps connection IDs to their respective collections
 */
export interface CollectionsMap {
    [connectionId: string]: CollectionWithSchema[];
}

/**
 * Configuration for a Weaviate connection
 */
export interface ConnectionConfig extends WeaviateConnection {
    /** Last time this connection was used */
    lastUsed?: number;
}


/**
 * Represents an item in the Weaviate Explorer tree view.
 * Extends vscode.TreeItem to include Weaviate-specific properties.
 */
export class WeaviateTreeItem extends vscode.TreeItem {
    /**
     * Creates a new instance of WeaviateTreeItem
     * @param label - The display label for the tree item
     * @param collapsibleState - The collapsible state of the tree item
     * @param itemType - The type of the tree item (connection, collection, metadata, etc.)
     * @param connectionId - Optional ID of the Weaviate connection this item belongs to
     * @param collectionName - Optional name of the collection this item belongs to
     * @param itemId - Optional ID for properties/vectors to identify the parent
     * @param iconPath - Optional icon for the tree item
     * @param contextValue - Optional context value used for conditional visibility/commands
     * @param description - Optional description text shown next to the label
     */
    constructor(
        public readonly label: string,
        public collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemType: 'connection' | 'collection' | 'metadata' | 'properties' | 'vectors' | 'property' | 'message' | 'object' | 'statistics' | 'invertedIndex' | 'vectorConfig' | 'sharding' | 'replication' | 'multiTenancy' | 'backup' | 'serverInfo' | 'clusterHealth' | 'modules' | 'collectionsGroup' | 'clusterNodes' | 'clusterNode' | 'clusterShards' | 'weaviateClusterNodeStatistics' | 'vectorConfigDetail'| 'propertyItem' | 'collectionReplication' | 'generativeConfig' | 'connectionLinks' | 'connectionLink',
        public readonly connectionId?: string,
        public readonly collectionName?: string,
        public readonly itemId?: string,
        iconPath?: string | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon,
        contextValue?: string,
        description?: string
    ) {
        super(label, collapsibleState);
        this.iconPath = iconPath;
        
        // Set context value based on itemType if not explicitly provided
        if (contextValue) {
            this.contextValue = contextValue;
        } else {
            switch (itemType) {
                case 'connection':
                    this.contextValue = 'weaviateConnection';
                    break;
                case 'collection':
                    this.contextValue = 'weaviateCollection';
                    break;
                case 'property':
                    this.contextValue = 'weaviateProperty';
                    break;
                default:
                    this.contextValue = itemType;
            }
        }
        
        if (description) {
            // @ts-ignore - We're setting a read-only property here
            this.description = description;
        }
    }
}
