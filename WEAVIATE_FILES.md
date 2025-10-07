# .weaviate Files Feature

The Weaviate Studio extension now supports `.weaviate` files to facilitate importing and sharing connection configurations.

## How to Use

1. **Create a .weaviate file**: Create a JSON file with the `.weaviate` extension containing the connection configuration.

2. **Open the file**: When you open a `.weaviate` file in VS Code, the extension will automatically:
   - Validate if the JSON contains a valid connection configuration
   - Offer options to add the connection to Weaviate Studio

## File Format

### Custom Connection
```json
{
  "name": "My Local Instance",
  "type": "custom",
  "httpHost": "localhost",
  "httpPort": 8080,
  "httpSecure": false,
  "grpcHost": "localhost", 
  "grpcPort": 50051,
  "grpcSecure": false,
  "apiKey": "optional-for-custom",
  "connectionVersion": "2"
}
```

### Cloud Connection
```json
{
  "name": "My Cloud Cluster",
  "type": "cloud",
  "cloudUrl": "https://my-cluster.weaviate.network",
  "apiKey": "your-api-key-here",
  "connectionVersion": "2"
}
```

## Required Fields

### For all connection types:
- `name`: Connection name (string, not empty)
- `type`: Connection type ("custom" or "cloud")

### For "custom" type:
- `httpHost`: HTTP host (string, not empty)

### For "cloud" type:
- `cloudUrl`: Cloud cluster URL (string, not empty)
- `apiKey`: API key (string, not empty)

## Optional Fields

- `httpPort`: HTTP port (default: 80)
- `httpSecure`: Whether to use HTTPS (default: false)
- `grpcHost`: gRPC host (default: same as httpHost)
- `grpcPort`: gRPC port (default: 50051)
- `grpcSecure`: Whether to use secure gRPC (default: false)
- `apiKey`: API key (for custom connections)
- `timeoutInit`: Initialization timeout
- `timeoutQuery`: Query timeout
- `timeoutInsert`: Insert timeout
- `connectionVersion`: Configuration version (recommended: "2")

## Features

### When opening a valid .weaviate file:

1. **First time**: 
   - "Add Connection": Adds the connection without connecting
   - "Add and Connect": Adds the connection and connects immediately
   - "Cancel": Does nothing

2. **Connection with existing name**:
   - "Overwrite Existing": Replaces the existing connection
   - "Add as New Connection": Adds with unique name (e.g., "Name (2)")
   - "Cancel": Does nothing

### Validation

The extension automatically validates:
- If the file contains valid JSON
- If it has all required fields
- If field types are correct
- If required values are not empty

### Error Cases

- **Invalid JSON**: Shows warning about invalid JSON format
- **Invalid configuration**: Shows warning about invalid connection configuration
- **Add error**: Shows error message with details

## Usage Examples

1. **Share configurations**: Send a `.weaviate` file to colleagues
2. **Connection backup**: Export your connections as `.weaviate` files
3. **Environment configurations**: Keep different files for dev/prod
4. **Documentation**: Include `.weaviate` files in repositories for easy setup

## Limitations

- Only files with `.weaviate` extension are processed automatically
- Validation is performed only when the file is opened, not during editing
- Duplicate connections are detected only by name (case-insensitive)