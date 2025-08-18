import { ChatOpenAI } from '@langchain/openai';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { config } from '../config/index.js';
import { HybridVectorStore, SearchResult } from './vectorStore.js';
import { Reranker } from './reranker.js';
import { Document } from 'langchain/document';
import { MockVectorStore, MockReranker, MockLLM } from './mock/mockServices.js';

export interface RAGResponse {
  answer: string;
  sources: Array<{
    content: string;
    metadata: Record<string, any>;
    relevanceScore: number;
  }>;
  metrics: {
    retrievalTime: number;
    rerankingTime: number;
    generationTime: number;
    totalTime: number;
  };
}

export class RAGPipeline {
  private vectorStore: HybridVectorStore | MockVectorStore;
  private reranker: Reranker | MockReranker;
  private llm: ChatOpenAI | MockLLM;
  private isMockMode: boolean;

  constructor() {
    this.isMockMode = config.mockMode;
    
    if (this.isMockMode) {
      console.log('🎭 RAG Pipeline running in MOCK MODE');
      this.vectorStore = new MockVectorStore();
      this.reranker = new MockReranker();
      this.llm = new MockLLM();
    } else {
      this.vectorStore = new HybridVectorStore();
      this.reranker = new Reranker();
      this.llm = new ChatOpenAI({
        openAIApiKey: config.openai.apiKey,
        modelName: config.openai.chatModel,
        temperature: 0.2,
        streaming: true,
      });
    }
  }

  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
  }

  async query(
    question: string,
    options: {
      useReranking?: boolean;
      useHybridSearch?: boolean;
      streamResponse?: boolean;
    } = {
      useReranking: true,
      useHybridSearch: true,
      streamResponse: false,
    }
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    const metrics = {
      retrievalTime: 0,
      rerankingTime: 0,
      generationTime: 0,
      totalTime: 0,
    };

    // Step 1: Retrieval
    const retrievalStart = Date.now();
    let searchResults: SearchResult[];
    
    if (options.useHybridSearch) {
      searchResults = await this.vectorStore.hybridSearch(question, config.rag.topK);
    } else {
      // Fallback to pure vector search
      searchResults = await this.vectorStore.hybridSearch(question, config.rag.topK);
    }
    metrics.retrievalTime = Date.now() - retrievalStart;

    // Step 2: Reranking
    const rerankingStart = Date.now();
    if (options.useReranking && searchResults.length > 0) {
      searchResults = await this.reranker.rerankWithMetadata(
        question,
        searchResults,
        config.rag.rerankTopK
      );
    }
    metrics.rerankingTime = Date.now() - rerankingStart;

    // Step 3: Generation
    const generationStart = Date.now();
    const answer = await this.generateAnswer(question, searchResults, options.streamResponse);
    metrics.generationTime = Date.now() - generationStart;

    metrics.totalTime = Date.now() - startTime;

    return {
      answer,
      sources: searchResults.map(result => ({
        content: result.document.pageContent,
        metadata: result.document.metadata,
        relevanceScore: result.score,
      })),
      metrics,
    };
  }

  private async generateAnswer(
    question: string,
    searchResults: SearchResult[],
    stream: boolean = false
  ): Promise<string> {
    if (searchResults.length === 0) {
      return "I couldn't find any relevant information to answer your question.";
    }

    const context = searchResults
      .map((result, index) => {
        const source = result.document.metadata.source || `Source ${index + 1}`;
        return `[${index + 1}] ${source}:\n${result.document.pageContent}`;
      })
      .join('\n\n');

    if (this.isMockMode) {
      return (this.llm as MockLLM).generateAnswer(question, context);
    }

    const prompt = PromptTemplate.fromTemplate(`
You are an advanced AI assistant with access to a knowledge base. Answer the question based on the provided context.

Instructions:
1. Provide a comprehensive yet concise answer
2. Cite sources using [1], [2], etc. when referencing specific information
3. If the context doesn't contain enough information, acknowledge this
4. Maintain accuracy and don't hallucinate information

Context:
{context}

Question: {question}

Answer:`);

    const chain = prompt.pipe(this.llm as ChatOpenAI).pipe(new StringOutputParser());

    if (stream) {
      // For streaming, we'd return an async generator
      // This is simplified for the demo
      const response = await chain.invoke({
        context,
        question,
      });
      return response;
    }

    return chain.invoke({
      context,
      question,
    });
  }

  async* streamQuery(
    question: string,
    options: {
      useReranking?: boolean;
      useHybridSearch?: boolean;
    } = {
      useReranking: true,
      useHybridSearch: true,
    }
  ): AsyncGenerator<{
    type: 'retrieval' | 'reranking' | 'generation' | 'complete';
    data?: any;
    chunk?: string;
  }> {
    // Step 1: Retrieval
    yield { type: 'retrieval' };
    
    let searchResults: SearchResult[];
    if (options.useHybridSearch) {
      searchResults = await this.vectorStore.hybridSearch(question, config.rag.topK);
    } else {
      searchResults = await this.vectorStore.hybridSearch(question, config.rag.topK);
    }
    
    yield { type: 'retrieval', data: { resultCount: searchResults.length } };

    // Step 2: Reranking
    if (options.useReranking && searchResults.length > 0) {
      yield { type: 'reranking' };
      searchResults = await this.reranker.rerankWithMetadata(
        question,
        searchResults,
        config.rag.rerankTopK
      );
      yield { type: 'reranking', data: { resultCount: searchResults.length } };
    }

    // Step 3: Generation with streaming
    yield { type: 'generation' };
    
    const context = searchResults
      .map((result, index) => {
        const source = result.document.metadata.source || `Source ${index + 1}`;
        return `[${index + 1}] ${source}:\n${result.document.pageContent}`;
      })
      .join('\n\n');

    if (this.isMockMode) {
      // Mock streaming
      const mockLLM = this.llm as MockLLM;
      for await (const chunk of mockLLM.streamAnswer(question, context)) {
        yield { type: 'generation', chunk };
      }
    } else {
      const prompt = PromptTemplate.fromTemplate(`
You are an advanced AI assistant. Answer based on the context provided.
Include citations using [1], [2], etc.

Context:
{context}

Question: {question}

Answer:`);

      const chain = prompt.pipe(this.llm as ChatOpenAI);
      const stream = await chain.stream({
        context,
        question,
      });

      for await (const chunk of stream) {
        const text = chunk.content.toString();
        if (text) {
          yield { type: 'generation', chunk: text };
        }
      }
    }

    yield { 
      type: 'complete', 
      data: {
        sources: searchResults.map(r => ({
          content: r.document.pageContent,
          metadata: r.document.metadata,
          score: r.score,
        }))
      }
    };
  }
}