import { CohereClient } from 'cohere-ai';
import { config } from '../config/index.js';
import { SearchResult } from './vectorStore.js';

export class Reranker {
  private cohere: CohereClient;

  constructor() {
    this.cohere = new CohereClient({
      token: config.cohere.apiKey,
    });
  }

  async rerank(
    query: string,
    results: SearchResult[],
    topK: number = config.rag.rerankTopK
  ): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    try {
      const documents = results.map(r => r.document.pageContent);
      
      const rerankResponse = await this.cohere.rerank({
        model: config.cohere.rerankModel,
        query,
        documents,
        topN: Math.min(topK, results.length),
        returnDocuments: false,
      });

      // Map reranked results back to original SearchResult objects
      const rerankedResults: SearchResult[] = [];
      
      for (const result of rerankResponse.results) {
        const originalResult = results[result.index];
        rerankedResults.push({
          ...originalResult,
          score: result.relevanceScore,
        });
      }

      return rerankedResults;
    } catch (error) {
      console.error('Reranking failed, returning original results:', error);
      return results.slice(0, topK);
    }
  }

  async rerankWithMetadata(
    query: string,
    results: SearchResult[],
    topK: number = config.rag.rerankTopK
  ): Promise<SearchResult[]> {
    if (results.length === 0) return [];

    try {
      // Enhance documents with metadata for better reranking
      const documents = results.map(r => {
        const metadata = r.document.metadata;
        const metadataStr = metadata.title ? `Title: ${metadata.title}\n\n` : '';
        return `${metadataStr}${r.document.pageContent}`;
      });
      
      const rerankResponse = await this.cohere.rerank({
        model: config.cohere.rerankModel,
        query,
        documents,
        topN: Math.min(topK, results.length),
        returnDocuments: false,
      });

      const rerankedResults: SearchResult[] = [];
      
      for (const result of rerankResponse.results) {
        const originalResult = results[result.index];
        rerankedResults.push({
          ...originalResult,
          score: result.relevanceScore,
        });
      }

      return rerankedResults;
    } catch (error) {
      console.error('Reranking with metadata failed:', error);
      return this.rerank(query, results, topK);
    }
  }
}