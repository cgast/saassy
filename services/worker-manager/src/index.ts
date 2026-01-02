import express from 'express';
import rateLimit from 'express-rate-limit';
import { createQueue } from './queue.js';
import { createWorkerProcessor } from './processor.js';
import { DockerManager } from './docker.js';
import { createRoutes } from './routes.js';

// Environment validation
const requiredEnvVars = ['INTERNAL_API_KEY'] as const;
const optionalEnvVars = ['PORT', 'REDIS_URL', 'POCKETBASE_URL', 'WORKER_NETWORK', 'MAX_CONCURRENT_WORKERS'] as const;

function validateEnvironment(): void {
  const missing: string[] = [];
  const insecure: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check for insecure defaults in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.INTERNAL_API_KEY === 'dev-secret-key') {
      insecure.push('INTERNAL_API_KEY is using insecure default value');
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    }
    console.warn(`WARNING: ${message}`);
  }

  if (insecure.length > 0) {
    throw new Error(`Security issues: ${insecure.join('; ')}`);
  }

  console.log('Environment validation passed');
}

const PORT = process.env.PORT || 3001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => req.path === '/health', // Don't rate limit health checks
});

async function main() {
  console.log('Starting Worker Manager...');

  // Validate environment before starting
  validateEnvironment();

  // Initialize Docker manager
  const docker = new DockerManager();
  await docker.init();

  // Initialize queue and processor
  const taskQueue = createQueue('tasks', REDIS_URL);
  const processor = createWorkerProcessor(docker, POCKETBASE_URL);

  // Start processing tasks
  processor.start(taskQueue);

  // Create Express app for internal API
  const app = express();
  app.use(express.json());
  app.use(apiLimiter); // Apply rate limiting

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Internal routes
  const routes = createRoutes(taskQueue, docker);
  app.use('/internal', routes);

  // Start server
  app.listen(PORT, () => {
    console.log(`Worker Manager listening on port ${PORT}`);
    console.log(`Redis: ${REDIS_URL}`);
    console.log(`PocketBase: ${POCKETBASE_URL}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await processor.stop();
    await taskQueue.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start Worker Manager:', err);
  process.exit(1);
});
