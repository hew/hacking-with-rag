import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config/index.js';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collectionName: string;
}

export class QdrantInitializer {
  private client: QdrantClient;
  private collectionName: string;

  constructor(config: QdrantConfig) {
    this.collectionName = config.collectionName;

    const url = new URL(config.url);
    this.client = new QdrantClient({
      url: url.hostname,
      port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 6333),
      https: url.protocol === 'https:',
      apiKey: config.apiKey,
    });
  }

  async checkHealth(): Promise<boolean> {
    try {
      const result = await this.client.api('get', '/readyz');
      return result.status === 200;
    } catch (error) {
      console.error('❌ Qdrant health check failed:', error);
      return false;
    }
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing Qdrant...');

    // Check health
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      throw new Error('Qdrant is not healthy. Please check your connection.');
    }

    // Check if collection exists
    const collections = await this.client.getCollections();
    const collectionExists = collections.collections.some(
      c => c.name === this.collectionName
    );

    if (collectionExists) {
      console.log(`✅ Collection "${this.collectionName}" already exists`);

      // Get collection info
      const info = await this.client.getCollection(this.collectionName);
      console.log(`📊 Collection info:
  - Vectors count: ${info.vectors_count}
  - Points count: ${info.points_count}
  - Indexed vectors: ${info.indexed_vectors_count}
  - Status: ${info.status}`);
    } else {
      console.log(`📝 Creating collection "${this.collectionName}"...`);
      await this.createCollection();
      console.log(`✅ Collection "${this.collectionName}" created`);
    }
  }

  private async createCollection(): Promise<void> {
    await this.client.createCollection(this.collectionName, {
      vectors: {
        size: 3072, // OpenAI text-embedding-3-large dimension
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });

    // Create payload index for hybrid search
    await this.client.createPayloadIndex(this.collectionName, {
      field_name: 'content',
      field_schema: 'text',
    });

    await this.client.createPayloadIndex(this.collectionName, {
      field_name: 'metadata.source',
      field_schema: 'keyword',
    });

    await this.client.createPayloadIndex(this.collectionName, {
      field_name: 'metadata.category',
      field_schema: 'keyword',
    });
  }

  async resetCollection(): Promise<void> {
    console.log(`🗑️ Resetting collection "${this.collectionName}"...`);

    try {
      await this.client.deleteCollection(this.collectionName);
      console.log('✅ Collection deleted');
    } catch (error) {
      console.log('ℹ️ Collection does not exist');
    }

    await this.createCollection();
    console.log('✅ Collection recreated');
  }

  async getCollectionStats(): Promise<any> {
    return await this.client.getCollection(this.collectionName);
  }

  async listCollections(): Promise<string[]> {
    const collections = await this.client.getCollections();
    return collections.collections.map(c => c.name);
  }
}

// Standalone initialization function
export async function initializeQdrant(reset: boolean = false): Promise<void> {
  if (config.mockMode) {
    console.log('📝 Running in mock mode - skipping Qdrant initialization');
    return;
  }

  const qdrantConfig: QdrantConfig = {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: 'rag_documents',
  };

  const initializer = new QdrantInitializer(qdrantConfig);

  try {
    if (reset) {
      await initializer.resetCollection();
    } else {
      await initializer.initialize();
    }

    // List all collections
    const collections = await initializer.listCollections();
    console.log('📚 Available collections:', collections);

  } catch (error) {
    console.error('❌ Failed to initialize Qdrant:', error);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Ensure Qdrant is running: ./scripts/setup-qdrant.sh');
    console.log('2. Check your .env file for correct QDRANT_URL');
    console.log('3. For cloud setup, verify your API key');
    console.log('4. Try running in mock mode: MOCK_MODE=true npm run dev');
    throw error;
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const reset = process.argv.includes('--reset');
  initializeQdrant(reset)
    .then(() => console.log('✅ Qdrant initialization complete'))
    .catch(() => process.exit(1));
}