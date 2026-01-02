import express from 'express';
import rateLimit from 'express-rate-limit';
import { createBillingProcessor } from './processor.js';
import { createRoutes } from './routes.js';
import { StripeService } from './stripe.js';

// Environment validation
const requiredEnvVars = ['INTERNAL_API_KEY', 'STRIPE_SECRET_KEY'] as const;
const optionalEnvVars = ['PORT', 'REDIS_URL', 'POCKETBASE_URL', 'STRIPE_WEBHOOK_SECRET'] as const;

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
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.warn('WARNING: STRIPE_WEBHOOK_SECRET is not set - webhooks will not be verified');
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

const PORT = process.env.PORT || 3002;
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
  console.log('Starting Billing Service...');

  // Validate environment before starting
  validateEnvironment();

  // Initialize Stripe service
  const stripeService = new StripeService();

  // Initialize billing processor (listens for usage events)
  const processor = createBillingProcessor(stripeService, POCKETBASE_URL, REDIS_URL);
  processor.start();

  // Create Express app
  const app = express();
  app.use(express.json());
  app.use(apiLimiter); // Apply rate limiting

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
