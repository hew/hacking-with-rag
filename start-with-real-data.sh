#!/bin/bash

echo "🚀 RAG System Setup with Real Data"
echo "=================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "📝 Please edit .env and add your API keys:"
    echo "   - OPENAI_API_KEY"
    echo "   - COHERE_API_KEY (optional)"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Check for API keys
source .env
if [ "$OPENAI_API_KEY" == "your_openai_api_key_here" ]; then
    echo "⚠️  Please add your OpenAI API key to .env file"
    echo "   Get one at: https://platform.openai.com/api-keys"
    echo ""
    echo "Or run in mock mode with: MOCK_MODE=true npm run dev"
    exit 1
fi

echo "✅ API keys configured"
echo ""

# Check for documents
if [ ! -d "documents" ] || [ -z "$(ls -A documents 2>/dev/null | grep -v '\.gitkeep')" ]; then
    echo "📁 No documents found in ./documents/"
    echo ""
    echo "Choose an option:"
    echo "1) Use sample documents"
    echo "2) Add your own documents to ./documents/ first"
    echo ""
    read -p "Enter choice (1 or 2): " choice

    if [ "$choice" == "1" ]; then
        echo "📄 Using sample documents..."
        npm run ingest:sample
    else
        echo ""
        echo "Please add documents to the ./documents/ directory"
        echo "Supported formats: .txt, .md, .pdf, .json, .csv, .html"
        echo ""
        echo "Then run: npm run ingest:files"
        exit 0
    fi
else
    echo "📄 Found documents in ./documents/"
    echo "Ingesting your documents..."
    npm run ingest:files
fi

echo ""
echo "🎯 Starting the server..."
npm run dev