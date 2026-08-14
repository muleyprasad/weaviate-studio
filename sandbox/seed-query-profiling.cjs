#!/usr/bin/env node

/**
 * Seeds searchable text collections for the local query-profiling smoke test.
 * Run after `docker compose -f docker-compose.profiling.yml up -d`.
 */

const baseUrl = process.env.WEAVIATE_URL || 'http://127.0.0.1:8080';
const apiKey = process.env.WEAVIATE_API_KEY || 'test-key-123';
const readinessTimeoutMs = 120_000;
const readinessPollIntervalMs = 1_500;

const collections = [
  {
    name: 'ProfileTest',
    description: 'Searchable documents for query-profiling smoke tests',
    objects: [
      { content: 'India independence day history and the national celebration', category: 'history' },
      { content: 'Indian national independence celebration and civic traditions', category: 'history' },
      { content: 'Vector database performance tuning for production workloads', category: 'technology' },
      { content: 'Query performance, shard timing, and vector search diagnostics', category: 'technology' },
      { content: 'Cooking with seasonal vegetables and regional ingredients', category: 'food' },
    ],
  },
  {
    name: 'TravelGuide',
    description: 'Searchable travel recommendations for local exploration tests',
    objects: [
      { content: 'Kyoto itinerary featuring temples, gardens, and quiet tea houses', category: 'Japan' },
      { content: 'Lisbon weekend guide with tiled streets, seafood, and hilltop views', category: 'Portugal' },
      { content: 'Iceland road trip planning for waterfalls, glaciers, and hot springs', category: 'Iceland' },
      { content: 'Melbourne coffee and laneway art walking tour', category: 'Australia' },
    ],
  },
  {
    name: 'ProductCatalog',
    description: 'Searchable products for semantic search and filtering experiments',
    objects: [
      { content: 'Noise cancelling wireless headphones with a thirty hour battery', category: 'electronics' },
      { content: 'Ergonomic office chair with adjustable lumbar support', category: 'furniture' },
      { content: 'Stainless steel insulated bottle for everyday commuting', category: 'lifestyle' },
      { content: 'Compact mechanical keyboard with quiet tactile switches', category: 'electronics' },
    ],
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function send(path, options = {}, withApiKey = true) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(withApiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  return { response, text: await response.text() };
}

async function request(path, options = {}) {
  let result = await send(path, options, true);
  if (result.response.status === 401) {
    result = await send(path, options, false);
  }

  if (!result.response.ok && result.response.status !== 404) {
    throw new Error(
      `${options.method || 'GET'} ${path} failed (${result.response.status}): ${result.text}`
    );
  }

  return result.text ? JSON.parse(result.text) : null;
}

async function waitForReady() {
  const deadline = Date.now() + readinessTimeoutMs;
  let lastStatus = 'connection not established';
  console.log('Waiting for Weaviate and the text vectorizer to become ready...');

  while (Date.now() < deadline) {
    try {
      const result = await send('/v1/.well-known/ready');
      if (result.response.ok) {
        console.log('Weaviate is ready.');
        return;
      }
      lastStatus = `HTTP ${result.response.status}`;
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }
    await sleep(readinessPollIntervalMs);
  }

  throw new Error(
    `Weaviate did not become ready within ${readinessTimeoutMs / 1000}s (${lastStatus}). Check docker compose logs.`
  );
}

async function createCollection({ name, description, objects }) {
  await request(`/v1/schema/${name}`, { method: 'DELETE' });
  await request('/v1/schema', {
    method: 'POST',
    body: JSON.stringify({
      class: name,
      description,
      vectorizer: 'text2vec-transformers',
      moduleConfig: {
        'text2vec-transformers': { vectorizeClassName: false },
      },
      properties: [
        { name: 'content', dataType: ['text'], description: 'Searchable text' },
        { name: 'category', dataType: ['text'], description: 'Document category' },
      ],
    }),
  });

  const result = await request('/v1/batch/objects', {
    method: 'POST',
    body: JSON.stringify({
      objects: objects.map(({ content, category }) => ({
        class: name,
        properties: { content, category },
      })),
    }),
  });

  const failed = result.filter((item) => item.result?.errors);
  if (failed.length > 0) {
    throw new Error(`Failed to seed ${name}: ${JSON.stringify(failed)}`);
  }

  console.log(`  ✓ ${name}: ${objects.length} searchable objects`);
}

async function seed() {
  await waitForReady();
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

  console.log(`Seeding searchable demo data on Weaviate ${version}:`);
  for (const collection of collections) {
    await createCollection(collection);
  }

  console.log('\nIn Weaviate Studio, choose ProfileTest → Vector Search.');
  console.log('Search for "independence day of india", enable Profile query, then run the search.');
}

seed().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
