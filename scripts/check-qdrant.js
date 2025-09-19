#!/usr/bin/env node

import { QdrantClient } from '@qdrant/js-client-rest';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(dirname(__dirname), '.env') });

const COLLECTION_NAME = 'rag_documents';

async function checkQdrant() {
  const url = process.env.QDRANT_URL || 'http://localhost:6333';
  const apiKey = process.env.QDRANT_API_KEY;

  console.log('🔍 Qdrant Health Check');
  console.log('=====================');
  console.log(`URL: ${url}`);
  console.log(`API Key: ${apiKey ? '✅ Configured' : '❌ Not configured'}`);
  console.log('');

  try {
    const urlObj = new URL(url);
    const client = new QdrantClient({
      url: urlObj.hostname,
      port: parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 6333),
      https: urlObj.protocol === 'https:',
      apiKey: apiKey,
    });

    // Check health endpoint
    console.log('Checking health endpoint...');
    const healthResponse = await fetch(`${url}/readyz`);
    if (healthResponse.ok) {
      console.log('✅ Qdrant is healthy');
    } else {
      console.log('❌ Qdrant health check failed');
      process.exit(1);
    }

    // Get cluster info
    console.log('\n📊 Cluster Information:');
    const info = await client.api('get', '/cluster');
    console.log(`  Status: ${info.data?.status || 'Unknown'}`);

    // List collections
    console.log('\n📚 Collections:');
    const collections = await client.getCollections();

    if (collections.collections.length === 0) {
      console.log('  No collections found');
    } else {
      for (const collection of collections.collections) {
        console.log(`  - ${collection.name}`);

        // Get collection details
        if (collection.name === COLLECTION_NAME) {
          const details = await client.getCollection(COLLECTION_NAME);
          console.log(`    • Vectors: ${details.vectors_count}`);
          console.log(`    • Points: ${details.points_count}`);
          console.log(`    • Status: ${details.status}`);
          console.log(`    • Dimension: ${details.config?.params?.vectors?.size || 'Unknown'}`);
        }
      }
    }

    // Check specific collection
    console.log(`\n🎯 Target Collection: "${COLLECTION_NAME}"`);
    const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);

    if (collectionExists) {
      console.log('✅ Collection exists');

      // Sample a few points
      try {
        const points = await client.scroll(COLLECTION_NAME, {
          limit: 3,
          with_payload: true,
          with_vector: false,
        });

        if (points[0].length > 0) {
          console.log(`\n📄 Sample documents (showing ${Math.min(3, points[0].length)}):`);
          points[0].slice(0, 3).forEach((point, i) => {
            const source = point.payload?.metadata?.source || 'Unknown';
            const title = point.payload?.metadata?.title || 'Untitled';
            console.log(`  ${i + 1}. ${title} (${source})`);
          });
        } else {
          console.log('\n⚠️ Collection is empty - run ingestion to add documents');
        }
      } catch (error) {
        console.log('\n⚠️ Could not retrieve sample documents');
      }
    } else {
      console.log('❌ Collection does not exist');
      console.log('Run ingestion to create it: npm run ingest:files');
    }

    console.log('\n✅ All checks passed!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Is Qdrant running? Try: ./scripts/setup-qdrant.sh');
    console.log('2. Check your .env file configuration');
    console.log('3. For Docker: docker ps | grep qdrant');
    console.log('4. Check logs: docker logs rag-qdrant');
    process.exit(1);
  }
}

// Run the check
checkQdrant();