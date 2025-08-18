#!/bin/bash

echo "🚀 Starting Advanced RAG Demo in Mock Mode"
echo "==========================================="
echo ""

# Set mock mode
export MOCK_MODE=true

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Ingest sample documents
echo "📚 Ingesting sample documents..."
npm run ingest

# Start the server
echo ""
echo "🎯 Starting server on http://localhost:3000"
echo ""
npm run dev