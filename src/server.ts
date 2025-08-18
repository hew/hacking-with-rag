import express from 'express';
import { RAGPipeline } from './lib/ragPipeline.js';
import { config } from './config/index.js';

const app = express();
const ragPipeline = new RAGPipeline();

app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Main RAG query endpoint
app.post('/api/query', async (req, res) => {
  try {
    const { question, useReranking = true, useHybridSearch = true } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const response = await ragPipeline.query(question, {
      useReranking,
      useHybridSearch,
      streamResponse: false,
    });

    res.json(response);
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Streaming RAG query endpoint
app.post('/api/query/stream', async (req, res) => {
  try {
    const { question, useReranking = true, useHybridSearch = true } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = ragPipeline.streamQuery(question, {
      useReranking,
      useHybridSearch,
    });

    for await (const event of stream) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Stream query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Comparison endpoint to showcase different configurations
app.post('/api/compare', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const configurations = [
      { name: 'Vector Search Only', useReranking: false, useHybridSearch: false },
      { name: 'Hybrid Search', useReranking: false, useHybridSearch: true },
      { name: 'Hybrid + Reranking', useReranking: true, useHybridSearch: true },
    ];

    const results = await Promise.all(
      configurations.map(async (config) => {
        const response = await ragPipeline.query(question, {
          useReranking: config.useReranking,
          useHybridSearch: config.useHybridSearch,
        });

        return {
          configuration: config.name,
          answer: response.answer,
          sources: response.sources.length,
          topSource: response.sources[0],
          metrics: response.metrics,
        };
      })
    );

    res.json({ question, comparisons: results });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function startServer() {
  try {
    await ragPipeline.initialize();
    
    app.listen(config.server.port, () => {
      console.log(`🚀 Advanced RAG Demo Server running on http://localhost:${config.server.port}`);
      console.log(`
Available endpoints:
  POST /api/query         - Standard RAG query
  POST /api/query/stream  - Streaming RAG query  
  POST /api/compare       - Compare different RAG configurations
  GET  /health           - Health check

Features:
  ✅ Hybrid search (vector + keyword)
  ✅ Query expansion
  ✅ Cross-encoder reranking
  ✅ Adaptive chunking
  ✅ Streaming responses
  ✅ Performance metrics
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();