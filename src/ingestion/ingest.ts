import { HybridVectorStore } from '../lib/vectorStore.js';
import { MockVectorStore } from '../lib/mock/mockServices.js';
import { ChunkingPipeline, AdaptiveChunking } from '../lib/chunking.js';
import { Document } from 'langchain/document';
import { config } from '../config/index.js';

const sampleDocuments = [
  {
    content: `
# Modern Web Application Performance Optimization

## Introduction
Performance optimization is crucial for modern web applications. Users expect fast, responsive interfaces, and search engines prioritize fast-loading websites. This guide covers advanced techniques for optimizing web application performance.

## Key Performance Metrics
- First Contentful Paint (FCP): Time until first content appears
- Largest Contentful Paint (LCP): Time until largest content element loads
- Time to Interactive (TTI): Time until page becomes fully interactive
- Cumulative Layout Shift (CLS): Visual stability metric

## Frontend Optimization Techniques

### Code Splitting
Dynamic imports and lazy loading reduce initial bundle size. Implement route-based code splitting in React applications using React.lazy() and Suspense. This technique can reduce initial load time by 40-60%.

### Image Optimization
- Use modern formats: WebP, AVIF provide 25-35% better compression
- Implement responsive images with srcset and sizes attributes
- Lazy load images below the fold using Intersection Observer
- Consider using CDN with automatic format selection

### Bundle Size Reduction
- Tree shaking removes unused code
- Minification and compression (gzip/brotli)
- Analyze bundle with webpack-bundle-analyzer
- Replace heavy libraries with lighter alternatives

## Backend Optimization

### Database Query Optimization
- Use indexes strategically on frequently queried columns
- Implement query result caching with Redis
- Optimize N+1 queries with eager loading
- Use database connection pooling

### API Response Optimization
- Implement pagination for large datasets
- Use GraphQL for precise data fetching
- Enable HTTP/2 for multiplexing
- Implement response compression

### Caching Strategies
- Browser caching with appropriate Cache-Control headers
- CDN caching for static assets
- Application-level caching for computed results
- Database query result caching

## Infrastructure Optimization

### CDN Implementation
Content Delivery Networks reduce latency by serving content from edge locations. Configure proper cache headers and implement cache invalidation strategies.

### Load Balancing
Distribute traffic across multiple servers using round-robin, least connections, or IP hash algorithms. Implement health checks and automatic failover.

### Auto-scaling
Configure horizontal scaling based on CPU, memory, or custom metrics. Use container orchestration platforms like Kubernetes for efficient resource utilization.
    `,
    metadata: {
      source: 'performance-guide.md',
      title: 'Web Performance Optimization Guide',
      category: 'technical',
      tags: ['performance', 'optimization', 'web'],
      author: 'Engineering Team',
      lastModified: '2024-01-15',
    },
  },
  {
    content: `
# Microservices Architecture Best Practices

## Overview
Microservices architecture enables building scalable, maintainable applications by decomposing monolithic systems into smaller, independent services. Each service owns its data and communicates through well-defined APIs.

## Service Design Principles

### Single Responsibility
Each microservice should have one reason to change. Focus on business capabilities rather than technical functions. A user service handles authentication and profile management, while an order service manages the ordering process.

### Service Boundaries
Define clear boundaries based on bounded contexts from Domain-Driven Design. Avoid chatty interfaces between services. Design for failure with circuit breakers and retry logic.

## Communication Patterns

### Synchronous Communication
REST APIs remain popular for request-response patterns. GraphQL provides flexible data fetching across services. gRPC offers high-performance binary protocol for internal service communication.

### Asynchronous Communication
Event-driven architecture using message queues (RabbitMQ, Kafka) enables loose coupling. Implement event sourcing for audit trails and system state reconstruction. Use CQRS to separate read and write models.

## Data Management

### Database per Service
Each service manages its own database to ensure loose coupling. Implement distributed transactions using Saga pattern. Handle eventual consistency in distributed systems.

### Data Synchronization
Use Change Data Capture (CDC) for real-time data synchronization. Implement event-driven updates between services. Consider CQRS for read-heavy workloads.

## Service Discovery and Load Balancing

### Service Registry
Implement service registration and discovery using Consul, Eureka, or Kubernetes Services. Enable dynamic service location without hardcoded endpoints.

### API Gateway
Centralize cross-cutting concerns like authentication, rate limiting, and monitoring. Implement request routing and protocol translation. Add response caching for improved performance.

## Observability

### Distributed Tracing
Implement correlation IDs for request tracking across services. Use tools like Jaeger or Zipkin for visualization. Monitor service dependencies and latencies.

### Metrics and Monitoring
Collect metrics using Prometheus or similar tools. Implement custom business metrics alongside technical metrics. Set up alerting for anomaly detection.

### Centralized Logging
Aggregate logs from all services using ELK stack or similar. Implement structured logging with consistent formats. Enable log correlation with trace IDs.
    `,
    metadata: {
      source: 'microservices-guide.md',
      title: 'Microservices Architecture Guide',
      category: 'architecture',
      tags: ['microservices', 'architecture', 'distributed-systems'],
      author: 'Architecture Team',
      lastModified: '2024-01-20',
    },
  },
  {
    content: `
# Machine Learning in Production

## Model Deployment Strategies

### Batch Inference
Process large volumes of data periodically. Suitable for non-real-time predictions like recommendation systems. Implement using Apache Spark or cloud-based batch processing.

### Real-time Inference
Deploy models as REST APIs using frameworks like FastAPI or Flask. Containerize with Docker for consistent deployment. Use model servers like TensorFlow Serving or TorchServe.

### Edge Deployment
Deploy models on edge devices for low-latency inference. Use model optimization techniques like quantization and pruning. Consider frameworks like TensorFlow Lite or ONNX Runtime.

## Model Versioning and Management

### Version Control
Track model versions alongside code using DVC or MLflow. Maintain model lineage and training data references. Implement A/B testing for model comparison.

### Model Registry
Centralize model storage and metadata. Track model performance metrics and deployment history. Implement approval workflows for production deployment.

## Monitoring and Maintenance

### Performance Monitoring
Track inference latency and throughput. Monitor resource utilization (CPU, memory, GPU). Set up alerts for performance degradation.

### Data Drift Detection
Monitor input data distributions for drift. Implement statistical tests for distribution comparison. Trigger retraining pipelines when drift detected.

### Model Performance Tracking
Monitor prediction accuracy in production. Track business metrics affected by model predictions. Implement feedback loops for continuous improvement.

## Infrastructure Considerations

### Scalability
Implement horizontal scaling for inference services. Use load balancers for request distribution. Consider serverless options for variable workloads.

### GPU Optimization
Batch requests for efficient GPU utilization. Implement model parallelism for large models. Use mixed precision training and inference.

### Cost Optimization
Right-size infrastructure based on workload. Implement request batching to reduce costs. Use spot instances for training workloads.
    `,
    metadata: {
      source: 'ml-production.md',
      title: 'ML in Production Guide',
      category: 'machine-learning',
      tags: ['ml', 'ai', 'production', 'deployment'],
      author: 'ML Engineering Team',
      lastModified: '2024-01-25',
    },
  },
];

async function ingestDocuments() {
  console.log('🚀 Starting document ingestion...');
  
  try {
    // Initialize vector store (use mock if in mock mode)
    const vectorStore = config.mockMode 
      ? new MockVectorStore() 
      : new HybridVectorStore();
    
    await vectorStore.initialize();
    console.log(`✅ ${config.mockMode ? 'Mock' : ''} Vector store initialized`);

    // Initialize chunking pipeline
    const chunkingPipeline = new ChunkingPipeline(new AdaptiveChunking(512, 128));
    
    // Process documents
    console.log(`📄 Processing ${sampleDocuments.length} documents...`);
    const chunks = await chunkingPipeline.processDocuments(sampleDocuments);
    console.log(`✂️ Created ${chunks.length} chunks`);

    // Add to vector store
    console.log('💾 Adding chunks to vector store...');
    await vectorStore.addDocuments(chunks);
    
    console.log('✅ Ingestion complete!');
    console.log(`
Summary:
- Documents processed: ${sampleDocuments.length}
- Total chunks created: ${chunks.length}
- Average chunks per document: ${Math.round(chunks.length / sampleDocuments.length)}
    `);

  } catch (error) {
    console.error('❌ Ingestion failed:', error);
    process.exit(1);
  }
}

// Run ingestion if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestDocuments();
}

export { ingestDocuments, sampleDocuments };