Weaviate Studio Design Specification

1. Core Data Browser (Foundation)
   The central hub for data exploration, designed to look and feel like a native VS Code file explorer but for database objects.

Key Features: Zero-query loading, smart type rendering (UUID shortening, relative dates, status pills), and standard developer interactions (copy-on-click, pagination).
Visual Style: Monospace fonts for IDs, high-contrast borders, and a dense table layout. 2. Visual Filter Builder
An intuitive point-and-click interface to construct complex database queries without writing GraphQL.

Logic: Supports "Match ALL" (AND) and "Match ANY" (OR) logic with nested grouping.
Type-Specific Operators: Contextual operators based on data types (e.g., "within distance" for geo, "between" for numbers).
Layout: A side-panel integration that updates the main table in real-time. 3. Vector Search Suite
Making semantic search accessible through three distinct modes:

Semantic (Text) Search: Natural language input with vectorizer configuration transparency.
Similar Object Search: Finds objects near a specific UUID, including a preview of the reference object and adjustable distance metrics (Cosine/Euclidean).
Raw Vector Input: For debugging, allowing direct entry of high-dimensional vectors with automated dimension validation. 4. Hybrid Search Interface
A specialized tool for balancing keyword relevance (BM25) with semantic meaning (Vectors).

The Alpha Slider: A custom UI component ranging from 0% (Keyword) to 100% (Semantic) to fine-tune the alpha parameter.
Match Breakdown: Visual scoring bars that explain why a result was returned by showing its keyword vs. semantic score. 5. Collection Insights (Aggregations)
A high-level dashboard providing instant statistical analysis of a collection.

Categorical Charts: Distribution bars for statuses and categories.
Numeric Statistics: Automated calculation of Min, Max, Mean, and Median for numerical properties.
Distribution Visualization: Histogram-style bars for custom range buckets (e.g., view counts). 6. Object Detail Panel
A deep-dive slide-out for inspecting a single database record.

Tabbed Navigation: Separate views for Properties, Metadata, Vectors (raw arrays), and References.
Graph Navigation: Clickable references that allow "hopping" from one object to its related entries.
Rich Metadata: Displays internal Weaviate timestamps, tenant info, and index status. 7. Export System
A utility for extracting data for external use or analysis.

Formats: Support for developer-friendly JSON, analyst-ready CSV/Excel, and big-data Parquet formats.
Selective Scoping: Allows exporting just the current view, all filtered results, or the entire collection.
Design Theme: VS Code Dark+ / Monokai
Primary Accent: Blue (#007ACC)
Typography: UI Sans-Serif with Monospace for data values.
