import { describe, it, expect } from 'vitest';
import { MockEmbeddings, MockVectorStore, MockReranker, MockLLM } from './mockServices.js';

describe('MockServices', () => {
  describe('MockEmbeddings', () => {
    it('should generate consistent embeddings for the same text', async () => {
      const embeddings = new MockEmbeddings();
      const text = 'test query';
      
      const embedding1 = await embeddings.embedQuery(text);
      const embedding2 = await embeddings.embedQuery(text);
      
      expect(embedding1).toEqual(embedding2);
      expect(embedding1).toHaveLength(1536);
    });

    it('should generate different embeddings for different texts', async () => {
      const embeddings = new MockEmbeddings();
      
      const embedding1 = await embeddings.embedQuery('query one');
      const embedding2 = await embeddings.embedQuery('query two');
      
      expect(embedding1).not.toEqual(embedding2);
    });
  });

  describe('MockVectorStore', () => {
    it('should initialize without errors', async () => {
      const store = new MockVectorStore();
      await expect(store.initialize()).resolves.not.toThrow();
    });

    it('should return empty results for empty store', async () => {
      const store = new MockVectorStore();
      await store.initialize();
      
      const results = await store.hybridSearch('test query');
      expect(results).toHaveLength(0);
    });
  });

  describe('MockReranker', () => {
    it('should rerank results', async () => {
      const reranker = new MockReranker();
      const mockResults = [
        {
          document: { pageContent: 'test content', metadata: {} },
          score: 0.5,
        },
      ];
      
      const reranked = await reranker.rerank('test query', mockResults as any);
      expect(reranked).toBeDefined();
      expect(reranked.length).toBeLessThanOrEqual(mockResults.length);
    });
  });

  describe('MockLLM', () => {
    it('should generate consistent answers for the same question', async () => {
      const llm = new MockLLM();
      const question = 'What is RAG?';
      
      const answer1 = await llm.generateAnswer(question, 'context');
      const answer2 = await llm.generateAnswer(question, 'context');
      
      expect(answer1).toEqual(answer2);
      expect(answer1.length).toBeGreaterThan(0);
    });
  });
});