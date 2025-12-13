# Saassy - SaaS Boilerplate Implementation Plan

## Overview

Saassy is a template/boilerplate for quickly bootstrapping SaaS platforms that run user-submitted tasks on Docker containers with usage-based billing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SAASSY ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐                                     │
│   │   Marketing  │     │   App        │     (Frontend - Next.js)            │
│   │   Website    │     │   Dashboard  │                                     │
│   └──────┬───────┘     └──────┬───────┘                                     │
│          │                    │                                              │
│          └────────┬───────────┘                                              │
│                   │                                                          │
│                   ▼                                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         PocketBase                                   │   │
│   │   • User Auth (email/password, OAuth)                               │   │
│   │   • Database (users, tasks, usage, subscriptions)                   │   │
│   │   • REST API & Realtime                                             │   │
│   │   • Admin Dashboard                                                  │   │
│   └──────────────────────────────┬──────────────────────────────────────┘   │
│                                  │                                           │
│          ┌───────────────────────┼───────────────────────┐                  │
│          │                       │                       │                  │
│          ▼                       ▼                       ▼                  │
│   ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐           │
│   │   Billing    │     │  Worker Manager  │     │   Stripe     │           │
│   │   Service    │◄────│  (Orchestrator)  │     │   Webhooks   │           │
│   └──────┬───────┘     └────────┬─────────┘     └──────┬───────┘           │
│          │                      │                      │                    │
│          │                      ▼                      │                    │
│          │             ┌────────────────┐              │                    │
│          │             │ Docker Workers │              │                    │
│          │             │ ┌────┐ ┌────┐  │              │                    │
│          │             │ │ W1 │ │ W2 │  │              │                    │
│          │             │ └────┘ └────┘  │              │                    │
│          │             └────────────────┘              │                    │
│          │                                             │                    │
│          └─────────────────────┬───────────────────────┘                    │
│                                ▼                                            │
│                         ┌──────────────┐                                    │
│                         │   Stripe     │                                    │
│                         │   API        │                                    │
│                         └──────────────┘                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
saassy/
├── apps/
│   ├── web/                    # Next.js - Marketing + App Dashboard
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (marketing)/    # Landing, pricing, docs
│   │   │   │   ├── (app)/          # User dashboard, tasks
│   │   │   │   └── api/            # API routes (webhooks)
│   │   │   ├── components/
│   │   │   └── lib/
│   │   └── package.json
│   │
│   └── pocketbase/             # PocketBase backend
│       ├── pb_migrations/      # Database migrations
│       ├── pb_hooks/           # JS hooks for custom logic
│       └── Dockerfile
│
├── services/
│   ├── worker-manager/         # Orchestrates Docker workers
│   │   ├── src/
│   │   │   ├── queue.ts        # Job queue management
│   │   │   ├── docker.ts       # Docker API wrapper
│   │   │   ├── monitor.ts      # Worker health monitoring
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── billing/                # Usage calculation & Stripe sync
│       ├── src/
│       │   ├── calculator.ts   # Resource/payload calculation
│       │   ├── stripe.ts       # Stripe integration
│       │   ├── usage.ts        # Usage tracking
│       │   └── index.ts
│       ├── package.json
│       └── Dockerfile
│
├── workers/
│   └── example/                # Example worker template
│       ├── src/
│       ├── Dockerfile
│       └── README.md
│
├── packages/
│   └── shared/                 # Shared types, utilities
│       ├── src/
│       │   ├── types.ts
│       │   └── utils.ts
│       └── package.json
│
├── docker-compose.yml          # Local development
├── docker-compose.prod.yml     # Production deployment
├── package.json                # Root package.json (workspaces)
├── turbo.json                  # Turborepo config
└── README.md
```

## Tech Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Frontend | Next.js 14 (App Router) | SSR, API routes, excellent DX |
| Auth & DB | PocketBase | Single binary, built-in auth, realtime, admin UI |
| Payments | Stripe | Industry standard, excellent API |
| Worker Orchestration | Node.js + Dockerode | Simple Docker API integration |
| Queue | BullMQ + Redis | Reliable job queue with retry |
| Monorepo | Turborepo | Fast builds, shared dependencies |
| Styling | Tailwind CSS | Rapid UI development |

## Implementation Phases

### Phase 1: Project Setup
- [ ] Initialize monorepo with Turborepo
- [ ] Set up shared packages and TypeScript config
- [ ] Create docker-compose for local development
- [ ] Set up environment variables structure

### Phase 2: PocketBase Backend
- [ ] Configure PocketBase with collections:
  - `users` (built-in, extended)
  - `subscriptions` (plan, status, stripe_id)
  - `tasks` (user_id, type, status, input, output, resource_usage)
  - `usage_records` (user_id, task_id, cpu_seconds, memory_mb, cost)
- [ ] Create migrations for schema
- [ ] Add JS hooks for business logic
- [ ] Configure OAuth providers (optional)

### Phase 3: Frontend - Marketing Website
- [ ] Landing page with value proposition
- [ ] Pricing page with Stripe integration
- [ ] Documentation/getting started page
- [ ] Auth pages (login, register, forgot password)

### Phase 4: Frontend - App Dashboard
- [ ] Dashboard overview (usage stats, recent tasks)
- [ ] Task creation interface
- [ ] Task list with status, logs, results
- [ ] Billing page (current usage, invoices, plan management)
- [ ] Settings page (API keys, profile)

### Phase 5: Worker Manager Service
- [ ] Docker API integration (create, start, stop, logs)
- [ ] Job queue with BullMQ
- [ ] Resource limits enforcement
- [ ] Health monitoring and auto-restart
- [ ] Webhook callbacks on task completion

### Phase 6: Billing Service
- [ ] Usage calculation based on:
  - CPU time
  - Memory usage
  - Execution duration
  - Custom metrics (per-task-type)
- [ ] Stripe integration:
  - Customer creation
  - Subscription management
  - Usage-based billing (metered)
  - Invoice webhooks

### Phase 7: Integration & Polish
- [ ] End-to-end task flow testing
- [ ] Error handling and logging
- [ ] Rate limiting
- [ ] Admin dashboard customization
- [ ] Production deployment scripts

## Database Schema (PocketBase Collections)

### users (extends built-in)
```javascript
{
  // Built-in fields: id, email, password, verified, etc.
  name: "string",
  stripe_customer_id: "string?",
  api_key: "string?"
}
```

### subscriptions
```javascript
{
  user: "relation(users)",
  plan: "select(free,starter,pro,enterprise)",
  status: "select(active,canceled,past_due)",
  stripe_subscription_id: "string?",
  current_period_end: "date",
  limits: "json" // { tasks_per_month, max_concurrent, max_duration }
}
```

### tasks
```javascript
{
  user: "relation(users)",
  type: "string",           // worker type identifier
  status: "select(pending,running,completed,failed)",
  input: "json",            // task input payload
  output: "json?",          // task result
  error: "string?",
  worker_id: "string?",     // Docker container ID
  started_at: "date?",
  completed_at: "date?",
  resource_usage: "json?"   // { cpu_seconds, memory_mb, duration }
}
```

### usage_records
```javascript
{
  user: "relation(users)",
  task: "relation(tasks)?",
  period: "string",         // "2024-01"
  cpu_seconds: "number",
  memory_mb_seconds: "number",
  task_count: "number",
  cost_cents: "number"
}
```

## API Endpoints

### PocketBase (auto-generated + hooks)
- `POST /api/collections/users/auth-with-password` - Login
- `POST /api/collections/users/records` - Register
- `GET/POST /api/collections/tasks/records` - Task CRUD
- `GET /api/collections/usage_records/records` - Usage history

### Next.js API Routes
- `POST /api/tasks/create` - Create task (validates, queues)
- `GET /api/tasks/[id]/logs` - Stream task logs
- `POST /api/webhooks/stripe` - Stripe webhook handler
- `POST /api/webhooks/task-complete` - Worker callback

### Worker Manager (internal)
- `POST /internal/tasks/start` - Start task execution
- `DELETE /internal/tasks/[id]` - Cancel task
- `GET /internal/workers/status` - Worker health check

## Stripe Integration

### Products & Prices
```javascript
// Example pricing model
const plans = {
  free: {
    tasks_per_month: 10,
    max_concurrent: 1,
    max_duration_seconds: 60,
    price_cents: 0
  },
  starter: {
    tasks_per_month: 100,
    max_concurrent: 3,
    max_duration_seconds: 300,
    price_cents: 1900,
    overage_per_task_cents: 10
  },
  pro: {
    tasks_per_month: 1000,
    max_concurrent: 10,
    max_duration_seconds: 3600,
    price_cents: 4900,
    overage_per_task_cents: 5
  }
}
```

### Metered Billing
- Report usage at task completion
- Stripe calculates overage automatically
- Invoice at end of billing period

## Environment Variables

```env
# PocketBase
POCKETBASE_URL=http://localhost:8090

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# Docker
DOCKER_HOST=unix:///var/run/docker.sock
WORKER_NETWORK=saassy-workers

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
INTERNAL_API_KEY=random-secret-key
```

## Security Considerations

1. **Worker Isolation**: Each worker runs in isolated Docker container with:
   - Limited CPU/memory
   - No network access (or restricted)
   - Read-only filesystem where possible
   - No privileged mode

2. **API Security**:
   - Rate limiting per user
   - API key authentication for programmatic access
   - CORS properly configured

3. **Input Validation**:
   - Sanitize all user inputs
   - Validate task payloads against schema
   - Size limits on uploads

## Deployment Options

### Option A: Single Server (Simple)
- Docker Compose on VPS
- PocketBase + Next.js + Services in containers
- Nginx reverse proxy
- Let's Encrypt SSL

### Option B: Scalable
- PocketBase on dedicated instance
- Next.js on Vercel/Railway
- Services on Railway/Render
- Workers on dedicated Docker hosts
- Redis Cloud

## Getting Started (After Implementation)

```bash
# Clone template
git clone https://github.com/you/saassy my-saas
cd my-saas

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your Stripe keys, etc.

# Start development
pnpm dev

# Visit:
# - http://localhost:3000 (Frontend)
# - http://localhost:8090/_/ (PocketBase Admin)
```

## Customization Points

When using this template, you'll typically customize:

1. **Workers**: Create your own worker images in `workers/`
2. **Pricing**: Adjust plans in Stripe and config
3. **Branding**: Update marketing pages, colors, logo
4. **Task Types**: Define your specific task schemas
5. **Billing Logic**: Adjust resource calculation formulas

---

## Approval Checklist

- [ ] Architecture makes sense for the use case
- [ ] Tech stack is acceptable
- [ ] Directory structure is clear
- [ ] Phased approach is reasonable
- [ ] Ready to proceed with implementation
