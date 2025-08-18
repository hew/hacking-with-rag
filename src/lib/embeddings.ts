import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../config/index.js';
import { Document } from 'langchain/document';

export class AdvancedEmbeddings {
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openai.apiKey,
      modelName: config.openai.embeddingModel,
      dimensions: 1536, // For text-embedding-3-large
    });
  }

  async embedDocuments(documents: Document[]): Promise<number[][]> {
    const texts = documents.map(doc => {
      // Enhance embedding with metadata
      const metadataString = Object.entries(doc.metadata)
        .filter(([key]) => ['title', 'category', 'tags'].includes(key))
        .map(([key, value]) => `${key}: ${value}`)
        .join(' ');
      
      return metadataString ? `${metadataString}\n\n${doc.pageContent}` : doc.pageContent;
    });

    return this.embeddings.embedDocuments(texts);
  }

  async embedQuery(query: string): Promise<number[]> {
    return this.embeddings.embedQuery(query);
  }

  async embedQueryWithExpansion(query: string): Promise<{
    original: number[];
    expanded: number[] | null;
    expansionTerms: string[];
  }> {
    const original = await this.embedQuery(query);
    
    // Query expansion using hypothetical answer generation
    const expansionTerms = await this.generateQueryExpansion(query);
    
    if (expansionTerms.length > 0) {
      const expandedQuery = `${query} ${expansionTerms.join(' ')}`;
      const expanded = await this.embedQuery(expandedQuery);
      return { original, expanded, expansionTerms };
    }

    return { original, expanded: null, expansionTerms: [] };
  }

  private async generateQueryExpansion(query: string): Promise<string[]> {
    // Simplified query expansion - in production, use LLM for this
    const expansions: Record<string, string[]> = {
      'performance': ['speed', 'optimization', 'efficiency', 'latency'],
      'security': ['authentication', 'authorization', 'encryption', 'vulnerability'],
      'api': ['endpoint', 'rest', 'graphql', 'interface'],
      'database': ['sql', 'nosql', 'query', 'index', 'schema'],
    };

    const terms: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [key, values] of Object.entries(expansions)) {
      if (lowerQuery.includes(key)) {
        terms.push(...values.filter(v => !lowerQuery.includes(v)).slice(0, 2));
      }
    }

    return terms;
  }
}