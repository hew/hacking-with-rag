import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  openai: z.object({
    apiKey: z.string().default('mock-api-key'),
    embeddingModel: z.string().default('text-embedding-3-large'),
    chatModel: z.string().default('gpt-4-turbo-preview'),
  }),
  cohere: z.object({
    apiKey: z.string().default('mock-api-key'),
    rerankModel: z.string().default('rerank-english-v3.0'),
  }),
  qdrant: z.object({
    url: z.string().url().default('http://localhost:6333'),
    apiKey: z.string().optional(),
    collectionName: z.string().default('advanced_rag_demo'),
  }),
  server: z.object({
    port: z.number().default(3000),
    nodeEnv: z.enum(['development', 'production', 'test', 'mock']).default('development'),
  }),
  rag: z.object({
    chunkSize: z.number().default(512),
    chunkOverlap: z.number().default(128),
    topK: z.number().default(10),
    rerankTopK: z.number().default(3),
    hybridSearchAlpha: z.number().default(0.5),
  }),
  mockMode: z.boolean().default(false),
});

const rawConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'mock-api-key',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL,
    chatModel: process.env.OPENAI_CHAT_MODEL,
  },
  cohere: {
    apiKey: process.env.COHERE_API_KEY || 'mock-api-key',
    rerankModel: process.env.COHERE_RERANK_MODEL,
  },
  qdrant: {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: process.env.QDRANT_COLLECTION_NAME,
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV as any || 'development',
  },
  rag: {
    chunkSize: parseInt(process.env.CHUNK_SIZE || '512', 10),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '128', 10),
    topK: parseInt(process.env.TOP_K || '10', 10),
    rerankTopK: parseInt(process.env.RERANK_TOP_K || '3', 10),
    hybridSearchAlpha: parseFloat(process.env.HYBRID_SEARCH_ALPHA || '0.5'),
  },
  mockMode: process.env.MOCK_MODE === 'true' || 
             (!process.env.OPENAI_API_KEY || !process.env.COHERE_API_KEY),
};

export const config = configSchema.parse(rawConfig);

if (config.mockMode) {
  console.warn('⚠️  Running in MOCK MODE - API keys not configured');
  console.warn('   To use real APIs, set OPENAI_API_KEY and COHERE_API_KEY in .env');
}

export type Config = z.infer<typeof configSchema>;