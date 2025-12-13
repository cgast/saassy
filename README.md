# Saassy

A complete SaaS boilerplate for running Docker-based tasks with usage-based billing.

## Features

- **User Authentication** - PocketBase handles auth, users, and database
- **Task Execution** - Run any Docker container as a task
- **Usage-Based Billing** - Stripe integration with metered billing
- **Real-time Updates** - PocketBase realtime subscriptions
- **Auto-scaling** - Tasks run on-demand in isolated containers
- **Admin Dashboard** - Built-in PocketBase admin UI

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Marketing     │     │   App Dashboard │
│   Website       │     │   (Next.js)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │      PocketBase       │
         │  (Auth, DB, Realtime) │
         └───────────┬───────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌─────────┐   ┌──────────────┐   ┌─────────┐
│ Billing │   │Worker Manager│   │ Stripe  │
│ Service │   │(Orchestrator)│   │Webhooks │
└────┬────┘   └──────┬───────┘   └────┬────┘
     │               │                │
     │        ┌──────▼──────┐         │
     │        │   Docker    │         │
     │        │  Workers    │         │
     │        └─────────────┘         │
     │                                │
     └──────────────┬─────────────────┘
                    ▼
              ┌──────────┐
              │  Stripe  │
              └──────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+
- pnpm 9+

### Development Setup

```bash
# Clone the repo
git clone https://github.com/you/saassy my-saas
cd my-saas

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Stripe keys

# Start infrastructure (PocketBase + Redis)
docker compose up -d

# Start development servers
pnpm dev
```

### Access Points

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| PocketBase Admin | http://localhost:8090/_/ |
| Worker Manager | http://localhost:3001 |
| Billing Service | http://localhost:3002 |

## Project Structure

```
saassy/
├── apps/
│   └── web/                    # Next.js frontend
├── services/
│   ├── worker-manager/         # Docker orchestration
│   └── billing/                # Usage & Stripe
├── workers/
│   └── example/                # Example worker template
├── packages/
│   └── shared/                 # Shared types & utils
├── data/
│   └── pocketbase/             # PocketBase data & migrations
├── docker-compose.yml          # Development
└── docker-compose.prod.yml     # Production
```

## Creating Workers

Workers are Docker containers that execute tasks. See `workers/example/` for a template.

```typescript
// workers/my-worker/src/index.ts
const input = JSON.parse(process.env.TASK_INPUT || '{}');

// Do your work here
const result = processTask(input);

// Output result as JSON
console.log(JSON.stringify(result));
process.exit(0);
```

## Configuration

### Environment Variables

See `.env.example` for all available options.

Key variables:
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `INTERNAL_API_KEY` - Service-to-service auth

### Stripe Setup

1. Create products in Stripe Dashboard
2. Set up metered pricing for usage-based billing
3. Add price IDs to `.env`
4. Configure webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`

## Production Deployment

```bash
# Build all services
pnpm build

# Start with production compose
docker compose -f docker-compose.prod.yml up -d
```

The production setup includes:
- Traefik reverse proxy with automatic SSL
- Health checks and auto-restart
- Resource limits

## Customization

When using this as a template:

1. **Workers** - Create your worker images in `workers/`
2. **Pricing** - Adjust plans in `packages/shared/src/constants.ts`
3. **Branding** - Update `apps/web/` with your brand
4. **Database** - Modify migrations in `data/pocketbase/pb_migrations/`

## License

MIT
