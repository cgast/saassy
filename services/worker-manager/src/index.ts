import express from 'express';
import { createQueue } from './queue.js';
import { createWorkerProcessor } from './processor.js';
import { DockerManager } from './docker.js';
import { createRoutes } from './routes.js';

const PORT = process.env.PORT || 3001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';

async function main() {
  console.log('Starting Worker Manager...');

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
