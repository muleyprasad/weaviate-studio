# Schema Management

Browse, visualize, and manage your Weaviate collection schemas with rich detail views and creation tools.

## Schema Explorer

### Overview Tab

Displays high-level collection information:

- Collection name and description
- Object count
- Vectorizer configuration
- Generative module configuration
- Sharding and replication settings

### Properties Tab

Lists all properties with detailed type information:

- Property names and data types
- Nested object structures (recursive navigation)
- Cross-reference targets
- Indexing configuration (searchable, filterable)

### Raw JSON Tab

Complete schema definition in JSON format — useful for programmatic access or documentation.

### API Equivalent Tab

Code examples for recreating the schema in:

- Python (Weaviate client)
- JavaScript/TypeScript
- cURL

### Creation Scripts

Ready-to-use Python scripts for recreating collections programmatically.

## Visual Type Icons

| Icon | Type            |
| ---- | --------------- |
| 🔤   | Text            |
| 🔢   | Number          |
| ⬜   | Boolean         |
| 📅   | Date            |
| 📦   | Object (nested) |
| 📍   | Geo Coordinates |
| 📞   | Phone           |
| 📁   | Blob            |

## Creating Collections

Three paths to create a new collection:

### From Scratch

Configure everything manually — name, properties, vectorizer, generative module.

### Copy from Existing

Clone an existing collection's schema as a starting point. Schema is pre-filled, ready for modification.

### Import from JSON

Load a schema definition from a JSON file — useful for version-controlled schemas or migration between instances.

## Nested Properties

Collections with nested objects are displayed hierarchically:

- Expand nested properties to see sub-properties
- Visual indentation shows nesting depth
- Cross-references are clearly marked

## Export Schema

Right-click any collection → **"Export Collection Schema"** to save the complete schema definition as JSON. Useful for:

- Version controlling schemas
- Sharing schemas with teammates
- Creating backups before schema changes
