import { Document } from 'langchain/document';
import { SearchResult } from '../vectorStore.js';

export class MockEmbeddings {
  async embedDocuments(texts: string[]): Promise<number[][]> {
    // Generate deterministic mock embeddings based on text hash
    return texts.map(text => this.generateMockEmbedding(text));
  }

  async embedQuery(query: string): Promise<number[]> {
    return this.generateMockEmbedding(query);
  }

  private generateMockEmbedding(text: string): number[] {
    // Create a simple deterministic embedding based on text characteristics
    const embedding = new Array(1536).fill(0);
    const hash = this.hashCode(text);
    
    for (let i = 0; i < 1536; i++) {
      embedding[i] = Math.sin(hash * (i + 1)) * 0.5 + 0.5;
    }
    
    return embedding;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }
}

export class MockVectorStore {
  private documents: Document[] = [];
  private embeddings: number[][] = [];

  async initialize(): Promise<void> {
    console.log('🔧 Mock Vector Store initialized');
  }

  async addDocuments(documents: Document[]): Promise<void> {
    this.documents.push(...documents);
    const mockEmbeddings = new MockEmbeddings();
    const newEmbeddings = await mockEmbeddings.embedDocuments(
      documents.map(d => d.pageContent)
    );
    this.embeddings.push(...newEmbeddings);
    console.log(`📝 Added ${documents.length} documents to mock store`);
  }

  async hybridSearch(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (this.documents.length === 0) {
      return [];
    }

    // Simple keyword matching for mock
    const queryWords = query.toLowerCase().split(' ');
    
    const results = this.documents
      .map((doc, index) => {
        const content = doc.pageContent.toLowerCase();
        const score = queryWords.reduce((acc, word) => {
          return acc + (content.includes(word) ? 1 : 0);
        }, 0) / queryWords.length;
        
        return {
          document: doc,
          score,
          index
        };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => ({
        document: r.document,
        score: r.score,
        vectorScore: r.score,
        keywordScore: r.score,
      }));

    // If no keyword matches, return random documents
    if (results.length === 0) {
      return this.documents.slice(0, Math.min(3, this.documents.length)).map((doc, i) => ({
        document: doc,
        score: 0.5 - (i * 0.1),
        vectorScore: 0.5 - (i * 0.1),
      }));
    }

    return results;
  }

  async deleteCollection(): Promise<void> {
    this.documents = [];
    this.embeddings = [];
  }
}

export class MockReranker {
  async rerank(
    query: string,
    results: SearchResult[],
    topK: number = 3
  ): Promise<SearchResult[]> {
    // Simple mock reranking based on query term frequency
    const queryWords = query.toLowerCase().split(' ');
    
    const reranked = results.map(result => {
      const content = result.document.pageContent.toLowerCase();
      const termFrequency = queryWords.reduce((acc, word) => {
        const regex = new RegExp(word, 'g');
        const matches = content.match(regex);
        return acc + (matches ? matches.length : 0);
      }, 0);
      
      return {
        ...result,
        score: Math.min(0.99, termFrequency / (queryWords.length * 5)),
      };
    });

    return reranked
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async rerankWithMetadata(
    query: string,
    results: SearchResult[],
    topK: number = 3
  ): Promise<SearchResult[]> {
    return this.rerank(query, results, topK);
  }
}

export class MockLLM {
  async generateAnswer(question: string, context: string): Promise<string> {
    const responses = [
      `Based on the provided context, here's a comprehensive answer to "${question}":

The documents discuss several key aspects relevant to your query. The implementation involves modern techniques and best practices that ensure optimal performance and scalability.

Key points include:
- Advanced optimization strategies that improve efficiency by 30-40%
- Robust architecture patterns for maintainable systems
- Comprehensive monitoring and observability practices

[1] The first source emphasizes the importance of proper system design.
[2] The second source provides detailed implementation guidelines.
[3] The third source covers advanced optimization techniques.

This approach has been proven effective in production environments.`,

      `To address your question about "${question}":

The context reveals three critical components:

1. **Performance Optimization**: The system implements cutting-edge techniques for reducing latency and improving throughput [1].

2. **Scalability Patterns**: Using microservices architecture and proper service boundaries ensures the system can grow efficiently [2].

3. **Monitoring & Observability**: Comprehensive metrics and logging enable proactive issue detection [3].

These elements work together to create a robust, production-ready solution.`,

      `Regarding "${question}":

Analysis of the provided sources reveals:

• Modern architectural patterns are essential for building scalable systems [1]
• Performance optimization requires a multi-faceted approach [2]  
• Proper monitoring ensures system reliability [3]

The implementation leverages industry best practices to achieve optimal results. This includes hybrid search capabilities, intelligent caching strategies, and adaptive resource management.

The recommended approach balances performance with maintainability.`
    ];

    // Select response based on question hash for consistency
    const hash = Math.abs(this.hashCode(question));
    return responses[hash % responses.length];
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }

  async *streamAnswer(question: string, context: string): AsyncGenerator<string> {
    const answer = await this.generateAnswer(question, context);
    const words = answer.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      yield words[i] + (i < words.length - 1 ? ' ' : '');
      // Simulate streaming delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}