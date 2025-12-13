import express from 'express';
import { createBillingProcessor } from './processor.js';
import { createRoutes } from './routes.js';
import { StripeService } from './stripe.js';

const PORT = process.env.PORT || 3002;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const POCKETBASE_URL = process.env.POCKETBASE_URL || 'http://localhost:8090';

async function main() {
  console.log('Starting Billing Service...');

  // Initialize Stripe service
  const stripeService = new StripeService();

  // Initialize billing processor (listens for usage events)
  const processor = createBillingProcessor(stripeService, POCKETBASE_URL, REDIS_URL);
  processor.start();

  // Create Express app
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Internal routes
  const routes = createRoutes(stripeService, POCKETBASE_URL);
  app.use('/internal', routes);

  // Start server
  app.listen(PORT, () => {
    console.log(`Billing Service listening on port ${PORT}`);
    console.log(`Redis: ${REDIS_URL}`);
    console.log(`PocketBase: ${POCKETBASE_URL}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await processor.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start Billing Service:', err);
  process.exit(1);
});
