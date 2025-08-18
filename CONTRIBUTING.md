# Contributing to Advanced RAG Demo

Thank you for your interest in contributing to the Advanced RAG Demo project! This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/advanced-rag-demo.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `npm install`
5. Run in mock mode for development: `MOCK_MODE=true npm run dev`

## Development Setup

### Mock Mode (Recommended for Development)
```bash
# No API keys required!
MOCK_MODE=true npm run dev
```

### Production Mode
```bash
# Requires API keys in .env file
npm run dev
```

## Code Style

- TypeScript with strict mode enabled
- Use async/await over promises
- Add types for all function parameters and returns
- Follow existing code patterns

## Testing

```bash
# Run TypeScript checks
npx tsc --noEmit

# Run tests (when available)
npm test
```

## Pull Request Process

1. Ensure your code compiles without errors
2. Update the README.md if you've added new features
3. Add tests for new functionality
4. Ensure all tests pass
5. Update documentation as needed
6. Submit a pull request with a clear description

## Feature Ideas

- [ ] Add support for more vector databases (Pinecone, Weaviate)
- [ ] Implement more chunking strategies
- [ ] Add support for document formats (DOCX, HTML, Markdown)
- [ ] Create Docker deployment
- [ ] Add authentication and user management
- [ ] Implement caching layer
- [ ] Add more LLM providers (Anthropic, Gemini)
- [ ] Create CLI tool for batch processing
- [ ] Add evaluation metrics and benchmarking

## Questions?

Feel free to open an issue for any questions or suggestions!