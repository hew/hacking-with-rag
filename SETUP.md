# 🚀 RAG System Setup Guide

This guide will help you set up the RAG system with real data using either local Qdrant (Docker) or Qdrant Cloud.

## Prerequisites

- Node.js 18+
- Docker (for local Qdrant setup)
- API Keys:
  - OpenAI API Key (required)
  - Cohere API Key (optional, for reranking)

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Interactive setup wizard
npm run qdrant:setup

# Or use the all-in-one script
./start-with-real-data.sh
```

### Option 2: Manual Setup

#### Step 1: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your API keys:
# - OPENAI_API_KEY=your_key_here
# - COHERE_API_KEY=your_key_here (optional)
```

#### Step 2: Set Up Qdrant

**Local Qdrant (Docker):**

```bash
# Using Docker Compose (recommended)
npm run docker:up

# Or standalone Docker
docker run -d \
  --name rag-qdrant \
  -p 6333:6333 \
  -v ./qdrant_storage:/qdrant/storage \
  qdrant/qdrant

# Verify Qdrant is running
npm run qdrant:check
```

**Qdrant Cloud:**

1. Sign up at https://cloud.qdrant.io
2. Create a cluster
3. Update `.env`:
   ```
   QDRANT_URL=https://your-cluster.qdrant.io
   QDRANT_API_KEY=your_api_key
   ```

#### Step 3: Add Your Documents

```bash
# Create documents directory
mkdir -p documents

# Add your files (supports .txt, .md, .pdf, .json, .csv, .html)
cp your-files/* documents/

# Or use the sample document
# (Already included: documents/example-nodejs-guide.md)
```

#### Step 4: Ingest Documents

```bash
# Ingest your documents
npm run ingest:files

# Or use sample documents
npm run ingest:sample
```

#### Step 5: Start the Server

```bash
npm run dev

# Open http://localhost:3000
```

## Available Commands

### Qdrant Management
- `npm run qdrant:setup` - Interactive setup wizard
- `npm run qdrant:check` - Check Qdrant health and status
- `npm run qdrant:init` - Initialize Qdrant collections
- `npm run qdrant:reset` - Reset and recreate collections
- `npm run docker:up` - Start Qdrant with Docker Compose
- `npm run docker:down` - Stop Qdrant containers
- `npm run docker:logs` - View Qdrant logs

### Document Ingestion
- `npm run ingest:files` - Ingest documents from ./documents/
- `npm run ingest:sample` - Ingest built-in sample documents
- `npm run ingest` - Default ingestion (sample docs)

### Development
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Run production build

## Testing Without API Keys

You can test the system without API keys using mock mode:

```bash
MOCK_MODE=true npm run dev
```

This simulates the full RAG pipeline with sample data.

## Supported Document Formats

- **Text**: `.txt`
- **Markdown**: `.md`, `.markdown`
- **PDF**: `.pdf` (requires pdf-parse)
- **JSON**: `.json`
- **CSV**: `.csv`
- **HTML**: `.html`, `.htm`

## Configuration Options

Edit `.env` to customize:

```bash
# Chunking parameters
CHUNK_SIZE=512
CHUNK_OVERLAP=128

# Retrieval parameters
TOP_K=10
RERANK_TOP_K=3

# Hybrid search balance (0=keyword, 1=vector)
HYBRID_SEARCH_ALPHA=0.5

# Server
PORT=3000
NODE_ENV=development
```

## Troubleshooting

### Qdrant Connection Issues

```bash
# Check if Qdrant is running
docker ps | grep qdrant

# View Qdrant logs
npm run docker:logs

# Test connection
npm run qdrant:check
```

### Port Conflicts

If port 6333 is in use:
```bash
# Find process using the port
lsof -i :6333

# Use alternative port in docker-compose.yml
# Update QDRANT_URL in .env accordingly
```

### Document Ingestion Fails

```bash
# Check Qdrant is initialized
npm run qdrant:init

# Reset and retry
npm run qdrant:reset
npm run ingest:files
```

### API Key Issues

- Ensure `.env` file exists and contains valid keys
- OpenAI: Get key from https://platform.openai.com/api-keys
- Cohere: Get key from https://dashboard.cohere.ai/api-keys

## Docker Compose Services

The `docker-compose.yml` includes:

1. **qdrant** - Vector database with built-in dashboard

Access the Qdrant Dashboard at:
```bash
# After starting Qdrant
http://localhost:6333/dashboard
```

## Production Deployment

For production, consider:

1. **Use Qdrant Cloud** for managed hosting
2. **Set NODE_ENV=production** in environment
3. **Use proper API key management** (e.g., AWS Secrets Manager)
4. **Implement rate limiting** and authentication
5. **Set up monitoring** and logging
6. **Use HTTPS** for all endpoints

## Next Steps

1. ✅ Qdrant is running
2. ✅ Documents are ingested
3. ✅ Server is running
4. 🎯 Visit http://localhost:3000
5. 🚀 Try queries related to your documents!

## Need Help?

- Check logs: `npm run docker:logs`
- Verify setup: `npm run qdrant:check`
- Reset everything: `npm run qdrant:reset`
- Run in mock mode: `MOCK_MODE=true npm run dev`