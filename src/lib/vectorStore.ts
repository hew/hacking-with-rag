import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';
import { Document } from 'langchain/document';
import { config } from '../config/index.js';
import { AdvancedEmbeddings } from './embeddings.js';

export interface SearchResult {
  document: Document;
  score: number;
  vectorScore?: number;
  keywordScore?: number;
}

export class HybridVectorStore {
  private client: QdrantClient;
  private embeddings: AdvancedEmbeddings;
  private collectionName: string;

  constructor() {
    this.client = new QdrantClient({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey,
    });
    this.embeddings = new AdvancedEmbeddings();
    this.collectionName = config.qdrant.collectionName;
  }

  async initialize(): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(c => c.name === this.collectionName);

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });

      // Create payload index for keyword search
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'content',
        field_schema: 'text',
      });

      await this.client.createPayloadIndex(this.collectionName, {
        field_name: 'metadata.title',
        field_schema: 'text',
      });
    }
  }

  async addDocuments(documents: Document[]): Promise<void> {
    const vectors = await this.embeddings.embedDocuments(documents);
    
    const points = documents.map((doc, i) => ({
      id: uuidv4(),
      vector: vectors[i],
      payload: {
        content: doc.pageContent,
        metadata: doc.metadata,
      },
    }));

    await this.client.upsert(this.collectionName, {
      wait: true,
      points,
    });
  }

  async hybridSearch(
    query: string,
    limit: number = config.rag.topK,
    alpha: number = config.rag.hybridSearchAlpha
  ): Promise<SearchResult[]> {
    // Get embeddings with query expansion
    const { original, expanded, expansionTerms } = await this.embeddings.embedQueryWithExpansion(query);
    
    // Vector search with original and expanded queries
    const vectorResults = await this.vectorSearch(
      expanded || original,
      limit * 2 // Get more results for fusion
    );

    // Keyword search
    const keywordResults = await this.keywordSearch(query, limit * 2);

    // Reciprocal Rank Fusion
    return this.reciprocalRankFusion(vectorResults, keywordResults, alpha, limit);
  }

  private async vectorSearch(embedding: number[], limit: number): Promise<SearchResult[]> {
    const results = await this.client.search(this.collectionName, {
      vector: embedding,
      limit,
      with_payload: true,
    });

    return results.map(r => ({
      document: new Document({
        pageContent: (r.payload as any).content,
        metadata: (r.payload as any).metadata,
      }),
      score: r.score || 0,
      vectorScore: r.score || 0,
    }));
  }

  private async keywordSearch(query: string, limit: number): Promise<SearchResult[]> {
    const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);
    
    if (searchTerms.length === 0) return [];

    const filter = {
      should: searchTerms.map(term => ({
        key: 'content',
        match: { text: term },
      })),
    };

    const results = await this.client.scroll(this.collectionName, {
      filter,
      limit,
      with_payload: true,
    });

    return results.points.map((r, idx) => ({
      document: new Document({
        pageContent: (r.payload as any).content,
        metadata: (r.payload as any).metadata,
      }),
      score: 1 - (idx / results.points.length), // Simple ranking based on order
      keywordScore: 1 - (idx / results.points.length),
    }));
  }

  private reciprocalRankFusion(
    vectorResults: SearchResult[],
    keywordResults: SearchResult[],
    alpha: number,
    limit: number
  ): SearchResult[] {
    const k = 60; // Constant for RRF
    const fusedScores = new Map<string, { result: SearchResult; score: number }>();

    // Process vector results
    vectorResults.forEach((result, rank) => {
      const key = result.document.pageContent.substring(0, 100);
      const rrfScore = alpha * (1 / (k + rank + 1));
      
      if (fusedScores.has(key)) {
        fusedScores.get(key)!.score += rrfScore;
      } else {
        fusedScores.set(key, { result, score: rrfScore });
      }
    });

    // Process keyword results
    keywordResults.forEach((result, rank) => {
      const key = result.document.pageContent.substring(0, 100);
      const rrfScore = (1 - alpha) * (1 / (k + rank + 1));
      
      if (fusedScores.has(key)) {
        fusedScores.get(key)!.score += rrfScore;
      } else {
        fusedScores.set(key, { result, score: rrfScore });
      }
    });

    // Sort by fused score and return top results
    return Array.from(fusedScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        ...item.result,
        score: item.score,
      }));
  }

  async deleteCollection(): Promise<void> {
    await this.client.deleteCollection(this.collectionName);
  }
}