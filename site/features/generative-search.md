---
title: Generative Search (RAG) — Ask Questions Across Weaviate Collections
description: Ask natural-language questions over self-hosted Weaviate data with RAG-powered answers and source attribution — Generative Search in Weaviate Studio for VS Code.
---

# Generative Search (RAG)

Ask natural-language questions across one or more collections and get AI-generated answers grounded in your Weaviate data — all within VS Code.

## How It Works

1. Select one or more **RAG-capable collections** (those with a generative module configured)
2. Type your question in natural language
3. The extension retrieves relevant objects using semantic search
4. Retrieved objects are sent to the configured LLM to generate a grounded answer
5. Source attribution shows which objects were used

## Features

| Feature                      | Description                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| **Multi-collection support** | Select multiple collections as pill badges                        |
| **Top-K control**            | Choose how many objects to retrieve per collection (3, 5, 10, 20) |
| **Query timeout**            | Adjustable timeout (30s, 60s, 2min, 5min)                         |
| **Markdown toggle**          | Switch between formatted view and raw markdown source             |
| **Copy answer**              | Copy full generated answer to clipboard                           |
| **Source attribution**       | Context objects display their originating collection              |
| **Retrieved context**        | Collapsible view grouped by collection with properties and scores |
| **Object inspection**        | Click 🔭 to open any context object in the Data Explorer          |

## Requirements

- A Weaviate instance with a **generative module** configured (e.g., `generative-openai`, `generative-cohere`)
- Collections must have the generative module enabled
- No additional API keys needed in the extension — it uses the server's generative config

## Query Controls

Located above the question input box:

| Control                    | Options              | Purpose                            |
| -------------------------- | -------------------- | ---------------------------------- |
| Collections                | Multi-select         | Choose which collections to search |
| Top results per collection | 3, 5, 10, 20         | How many objects provide context   |
| Query timeout              | 30s, 60s, 2min, 5min | Maximum wait time                  |

## Answer Tools

Each generated answer includes:

| Tool                    | Action                                          |
| ----------------------- | ----------------------------------------------- |
| 📝 Markdown / Formatted | Toggle between rendered markdown and raw source |
| 📋 Copy                 | Copy answer to clipboard                        |

## Query Metadata

Below each answer:

- **📚 From:** List of queried collections
- **⏱️ Query completed in:** Execution time

## Retrieved Context

When "Show retrieved context" is enabled:

- Context objects grouped by collection
- First 3 text properties, UUID, and relevance scores (distance/certainty/score)
- Click telescope icon (🔭) to inspect objects in Data Explorer

## Keyboard Shortcuts

| Key           | Action        |
| ------------- | ------------- |
| `Enter`       | Send question |
| `Shift+Enter` | New line      |

## Quick Access

Right-click any collection in the sidebar → **"Generative Search"** to open the panel with that collection pre-selected. If the panel is already open, right-clicking another collection adds it as a new pill without clearing existing selections.
