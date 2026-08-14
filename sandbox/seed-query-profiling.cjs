#!/usr/bin/env node

/**
 * Seeds a small manual-vector collection for Query Profiling smoke tests.
 * Run after `docker compose up -d` from the sandbox directory.
 */

const baseUrl = process.env.WEAVIATE_URL || 'http://127.0.0.1:8080';
const apiKey = process.env.WEAVIATE_API_KEY || 'test-key-123';
const collectionName = 'ProfileTest';

async function request(path, options = {}) {
  const send = async (withApiKey) => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(withApiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    return { response, text: await response.text() };
  };

  // The committed compose sandbox uses an API key. Retrying without the header also
  // makes the helper convenient for a temporary anonymous local development instance.
  let result = await send(true);
  if (result.response.status === 401) {
    result = await send(false);
  }

  if (!result.response.ok && result.response.status !== 404) {
    throw new Error(
      `${options.method || 'GET'} ${path} failed (${result.response.status}): ${result.text}`
    );
  }

  return result.text ? JSON.parse(result.text) : null;
}

async function seed() {
  const meta = await request('/v1/meta');
  const version = meta?.version || 'unknown';
  const versionParts = version.split('.').map(Number);
  const supportsProfiling =
    versionParts.length >= 3 &&
    (versionParts[0] > 1 ||
      (versionParts[0] === 1 &&
        (versionParts[1] > 36 || (versionParts[1] === 36 && versionParts[2] >= 9))));

  if (!supportsProfiling) {
    throw new Error(`Query profiling requires Weaviate 1.36.9+. Connected server: ${version}`);
  }

  await request(`/v1/schema/${collectionName}`, { method: 'DELETE' });

  await request('/v1/schema', {
    method: 'POST',
    body: JSON.stringify({
      class: collectionName,
      description: 'Small manual-vector collection for query profiling smoke tests',
      vectorizer: 'none',
      vectorIndexType: 'hnsw',
      vectorIndexConfig: { distance: 'cosine' },
      properties: [
        { name: 'content', dataType: ['text'], description: 'Searchable test content' },
        { name: 'category', dataType: ['text'], description: 'Test category' },
      ],
    }),
  });

  const objects = [
    { content: 'India independence day history', category: 'history', vector: [1, 0, 0] },
    { content: 'Indian national independence celebration', category: 'history', vector: [0.96, 0.1, 0] },
    { content: 'Vector database performance tuning', category: 'technology', vector: [0, 1, 0] },
    { content: 'Query performance and shard timing', category: 'technology', vector: [0, 0.9, 0.1] },
    { content: 'Cooking with seasonal vegetables', category: 'food', vector: [0, 0, 1] },
  ];

  const result = await request('/v1/batch/objects', {
    method: 'POST',
    body: JSON.stringify({
      objects: objects.map(({ content, category, vector }) => ({
        class: collectionName,
        properties: { content, category },
        vector,
      })),
    }),
  });

  const failed = result.filter((item) => item.result?.errors);
  if (failed.length > 0) {
    throw new Error(`Failed to seed ${failed.length} object(s): ${JSON.stringify(failed)}`);
  }

  console.log(`Seeded ${objects.length} objects in ${collectionName} on Weaviate ${version}.`);
  console.log('In Weaviate Studio, open ProfileTest → Vector Search → Raw Vector.');
  console.log('Enter [1, 0, 0], enable Profile query, then select Run Vector Search.');
}

seed().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
