import { HybridVectorStore } from '../lib/vectorStore.js';
import { MockVectorStore } from '../lib/mock/mockServices.js';
import { ChunkingPipeline, AdaptiveChunking } from '../lib/chunking.js';
import { config } from '../config/index.js';
import fs from 'fs/promises';
import path from 'path';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { CSVLoader } from '@langchain/community/document_loaders/fs/csv';

interface FileDocument {
  content: string;
  metadata: {
    source: string;
    title: string;
    fileType: string;
    [key: string]: any;
  };
}

async function loadDocumentFromFile(filePath: string): Promise<FileDocument> {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  let content: string;
  let metadata: any = {
    source: fileName,
    title: fileName.replace(ext, ''),
    fileType: ext.substring(1),
    filePath: filePath
  };

  try {
    switch (ext) {
      case '.txt':
      case '.md':
      case '.markdown':
        content = await fs.readFile(filePath, 'utf-8');
        break;

      case '.pdf':
        const pdfLoader = new PDFLoader(filePath);
        const pdfDocs = await pdfLoader.load();
        content = pdfDocs.map(doc => doc.pageContent).join('\n\n');
        metadata.pageCount = pdfDocs.length;
        break;

      case '.json':
        const jsonContent = await fs.readFile(filePath, 'utf-8');
        const jsonData = JSON.parse(jsonContent);
        content = JSON.stringify(jsonData, null, 2);
        break;

      case '.csv':
        const csvLoader = new CSVLoader(filePath);
        const csvDocs = await csvLoader.load();
        content = csvDocs.map(doc => doc.pageContent).join('\n');
        break;

      case '.html':
      case '.htm':
        const htmlContent = await fs.readFile(filePath, 'utf-8');
        // Simple HTML to text conversion (removes tags)
        content = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        break;

      default:
        // Try to read as text
        content = await fs.readFile(filePath, 'utf-8');
    }

    // Extract title from markdown headers if available
    if (ext === '.md' || ext === '.markdown') {
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        metadata.title = titleMatch[1];
      }
    }

    // Add file stats
    const stats = await fs.stat(filePath);
    metadata.fileSize = stats.size;
    metadata.lastModified = stats.mtime.toISOString();

    return { content, metadata };
  } catch (error) {
    console.error(`Error loading file ${filePath}:`, error);
    throw error;
  }
}

async function loadDocumentsFromDirectory(dirPath: string): Promise<FileDocument[]> {
  const documents: FileDocument[] = [];

  try {
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      // Skip hidden files and .gitkeep
      if (file.startsWith('.')) continue;

      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        // Recursively load from subdirectories
        const subDocs = await loadDocumentsFromDirectory(filePath);
        documents.push(...subDocs);
      } else {
        try {
          console.log(`📄 Loading: ${filePath}`);
          const doc = await loadDocumentFromFile(filePath);
          documents.push(doc);
        } catch (error) {
          console.warn(`⚠️ Skipping file ${filePath}: ${error}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }

  return documents;
}

async function ingestDocuments(documentsPath?: string) {
  const docsPath = documentsPath || path.join(process.cwd(), 'documents');

  console.log('🚀 Starting document ingestion...');
  console.log(`📁 Looking for documents in: ${docsPath}`);

  try {
    // Check if documents directory exists
    try {
      await fs.access(docsPath);
    } catch {
      console.log(`📂 Creating documents directory at: ${docsPath}`);
      await fs.mkdir(docsPath, { recursive: true });
      console.log(`
⚠️  No documents found! Please add documents to the 'documents' directory:

Supported formats:
  - Text files (.txt)
  - Markdown (.md, .markdown)
  - PDFs (.pdf)
  - JSON (.json)
  - CSV (.csv)
  - HTML (.html, .htm)

Example:
  documents/
    ├── research-paper.pdf
    ├── documentation.md
    ├── data.csv
    └── notes.txt
      `);
      return;
    }

    // Load documents from directory
    const documents = await loadDocumentsFromDirectory(docsPath);

    if (documents.length === 0) {
      console.log(`
⚠️  No documents found in ${docsPath}

Please add documents to the directory. Supported formats:
  - Text files (.txt)
  - Markdown (.md, .markdown)
  - PDFs (.pdf)
  - JSON (.json)
  - CSV (.csv)
  - HTML (.html, .htm)
      `);
      return;
    }

    console.log(`✅ Loaded ${documents.length} documents`);

    // Initialize vector store
    const vectorStore = config.mockMode
      ? new MockVectorStore()
      : new HybridVectorStore();

    await vectorStore.initialize();
    console.log(`✅ ${config.mockMode ? 'Mock' : ''} Vector store initialized`);

    // Initialize chunking pipeline
    const chunkSize = parseInt(process.env.CHUNK_SIZE || '512');
    const chunkOverlap = parseInt(process.env.CHUNK_OVERLAP || '128');
    const chunkingPipeline = new ChunkingPipeline(
      new AdaptiveChunking(chunkSize, chunkOverlap)
    );

    // Process documents
    console.log(`📄 Processing ${documents.length} documents...`);
    const chunks = await chunkingPipeline.processDocuments(documents);
    console.log(`✂️ Created ${chunks.length} chunks`);

    // Add to vector store
    console.log('💾 Adding chunks to vector store...');
    await vectorStore.addDocuments(chunks);

    // Print summary
    console.log('✅ Ingestion complete!');
    console.log(`
📊 Summary:
  - Documents processed: ${documents.length}
  - Total chunks created: ${chunks.length}
  - Average chunks per document: ${Math.round(chunks.length / documents.length)}
  - Chunk size: ${chunkSize}
  - Chunk overlap: ${chunkOverlap}

📝 Document Details:
${documents.map(doc => `  - ${doc.metadata.title} (${doc.metadata.fileType}, ${(doc.metadata.fileSize / 1024).toFixed(1)}KB)`).join('\n')}

🚀 Your RAG system is ready! Start the server with:
  npm run dev

Then visit http://localhost:3000
    `);

  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  }
}

// Run ingestion if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const customPath = process.argv[2];
  ingestDocuments(customPath);
}

export { ingestDocuments, loadDocumentFromFile, loadDocumentsFromDirectory };
