#!/usr/bin/env node

/**
 * Smoke test for MMR diversity against the local sandbox server.
 * Run after `docker compose -f docker-compose.profiling.yml up -d` and
 * `node seed-query-profiling.cjs`.
 */

import weaviate from 'weaviate-client';

const apiKey = process.env.WEAVIATE_API_KEY || 'test-key-123';
const client = await weaviate.connectToLocal({
  host: '127.0.0.1',
  port: 8080,
  grpcPort: 50051,
  authCredentials: new weaviate.ApiKey(apiKey),
});

try {
  const collection = client.collections.get('ProfileTest');
  const query = 'independence day of india';
  // No distance filter, so every seeded object is a candidate and MMR has room
  // to reorder across categories.
  const options = { limit: 5 };

  const plain = await collection.query.nearText(query, options);
  const ids = (result) => result.objects.map((o) => o.properties.category);
  console.log('plain order:       ', ids(plain).join(' > '));

  for (const candidateLimit of [25, 5, 1]) {
    try {
      const diversified = await collection.query.nearText(query, {
        ...options,
        diversity: { type: 'mmr', balance: 0.3, limit: candidateLimit },
      });
      console.log(
        `mmr limit=${candidateLimit}:`.padEnd(19),
        ids(diversified).join(' > '),
        `(${diversified.objects.length} returned)`
      );
    } catch (error) {
      console.log(`mmr limit=${candidateLimit}:`.padEnd(19), `FAILED → ${error.message}`);
    }
  }

  // What the extension now sends when no candidate pool is configured.
  for (const balance of [0, 1]) {
    const diversified = await collection.query.nearText(query, {
      ...options,
      diversity: { type: 'mmr', balance, limit: options.limit },
    });
    console.log(`balance=${balance} (limit=${options.limit}):`.padEnd(19), ids(diversified).join(' > '));
  }
} finally {
  await client.close();
}
