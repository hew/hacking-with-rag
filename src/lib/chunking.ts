import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TokenTextSplitter } from 'langchain/text_splitter';
import { encoding_for_model } from 'tiktoken';

export interface ChunkingStrategy {
  name: string;
  chunk(text: string, metadata?: Record<string, any>): Promise<Document[]>;
}

export class SemanticChunking implements ChunkingStrategy {
  name = 'semantic';
  private splitter: RecursiveCharacterTextSplitter;

  constructor(chunkSize: number = 512, chunkOverlap: number = 128) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
      lengthFunction: (text: string) => text.length,
    });
  }

  async chunk(text: string, metadata?: Record<string, any>): Promise<Document[]> {
    const docs = await this.splitter.createDocuments([text]);
    return docs.map((doc, index) => ({
      ...doc,
      metadata: {
        ...metadata,
        chunkIndex: index,
        chunkingStrategy: this.name,
      },
    }));
  }
}

export class TokenBasedChunking implements ChunkingStrategy {
  name = 'token';
  private splitter: TokenTextSplitter;

  constructor(chunkSize: number = 512, chunkOverlap: number = 128) {
    this.splitter = new TokenTextSplitter({
      encodingName: 'cl100k_base',
      chunkSize,
      chunkOverlap,
    });
  }

  async chunk(text: string, metadata?: Record<string, any>): Promise<Document[]> {
    const docs = await this.splitter.createDocuments([text]);
    return docs.map((doc, index) => ({
      ...doc,
      metadata: {
        ...metadata,
        chunkIndex: index,
        chunkingStrategy: this.name,
      },
    }));
  }
}

export class AdaptiveChunking implements ChunkingStrategy {
  name = 'adaptive';
  private semanticChunker: SemanticChunking;
  private tokenChunker: TokenBasedChunking;

  constructor(chunkSize: number = 512, chunkOverlap: number = 128) {
    this.semanticChunker = new SemanticChunking(chunkSize, chunkOverlap);
    this.tokenChunker = new TokenBasedChunking(chunkSize, chunkOverlap);
  }

  async chunk(text: string, metadata?: Record<string, any>): Promise<Document[]> {
    // Determine content type and choose strategy
    const contentType = this.detectContentType(text);
    
    let chunks: Document[];
    if (contentType === 'code') {
      // Use smaller chunks for code
      const codeChunker = new SemanticChunking(256, 64);
      chunks = await codeChunker.chunk(text, metadata);
    } else if (contentType === 'structured') {
      // Use token-based for structured content
      chunks = await this.tokenChunker.chunk(text, metadata);
    } else {
      // Use semantic for narrative text
      chunks = await this.semanticChunker.chunk(text, metadata);
    }

    // Add context windows (previous and next chunk references)
    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        contentType,
        hasPrevious: index > 0,
        hasNext: index < chunks.length - 1,
        totalChunks: chunks.length,
      },
    }));
  }

  private detectContentType(text: string): 'code' | 'structured' | 'narrative' {
    const codePatterns = /(?:function|class|import|export|const|let|var|if|for|while|return)\s/g;
    const structuredPatterns = /(?:\|.*\||\t|^\s*[-*]\s|^\d+\.)/gm;
    
    const codeMatches = (text.match(codePatterns) || []).length;
    const structuredMatches = (text.match(structuredPatterns) || []).length;
    
    const textLength = text.length;
    const codeRatio = codeMatches / (textLength / 100);
    const structuredRatio = structuredMatches / (textLength / 100);
    
    if (codeRatio > 0.5) return 'code';
    if (structuredRatio > 0.3) return 'structured';
    return 'narrative';
  }
}

export class ChunkingPipeline {
  private strategy: ChunkingStrategy;

  constructor(strategy: ChunkingStrategy = new AdaptiveChunking()) {
    this.strategy = strategy;
  }

  async processDocuments(
    documents: Array<{ content: string; metadata?: Record<string, any> }>
  ): Promise<Document[]> {
    const allChunks: Document[] = [];

    for (const doc of documents) {
      const chunks = await this.strategy.chunk(doc.content, doc.metadata);
      
      // Add document-level metadata to each chunk
      const enhancedChunks = chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          sourceDocument: doc.metadata?.source || 'unknown',
          timestamp: new Date().toISOString(),
        },
      }));

      allChunks.push(...enhancedChunks);
    }

    return allChunks;
  }

  setStrategy(strategy: ChunkingStrategy): void {
    this.strategy = strategy;
  }
}