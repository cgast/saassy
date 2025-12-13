import type { PlanLimits, PlanType } from './types.js';

// ===========================================
// Plan Configuration
// ===========================================

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    tasksPerMonth: 10,
    maxConcurrent: 1,
    maxDurationSeconds: 60,
  },
  starter: {
    tasksPerMonth: 100,
    maxConcurrent: 3,
    maxDurationSeconds: 300,
  },
  pro: {
    tasksPerMonth: 1000,
    maxConcurrent: 10,
    maxDurationSeconds: 3600,
  },
  enterprise: {
    tasksPerMonth: -1, // unlimited
    maxConcurrent: 50,
    maxDurationSeconds: 86400,
  },
};

export const PLAN_PRICES_CENTS: Record<PlanType, number> = {
  free: 0,
  starter: 1900,
  pro: 4900,
  enterprise: 19900,
};

export const OVERAGE_PRICE_CENTS: Record<PlanType, number> = {
  free: 50, // $0.50 per task over limit
  starter: 10, // $0.10 per task
  pro: 5, // $0.05 per task
  enterprise: 2, // $0.02 per task
};

// ===========================================
// Resource Pricing
// ===========================================

export const RESOURCE_PRICES = {
  cpuSecondCents: 0.001, // $0.00001 per CPU second
  memoryMbSecondCents: 0.0001, // $0.000001 per MB-second
};

// ===========================================
// Worker Defaults
// ===========================================

export const WORKER_DEFAULTS = {
  cpuLimit: 1,
  memoryLimit: '512m',
  timeoutSeconds: 300,
  network: 'saassy-workers',
};

// ===========================================
// Queue Names
// ===========================================

export const QUEUE_NAMES = {
  tasks: 'saassy:tasks',
  billing: 'saassy:billing',
  notifications: 'saassy:notifications',
};

// ===========================================
// API Routes
// ===========================================

export const API_ROUTES = {
  // Public API
  tasks: '/api/tasks',
  usage: '/api/usage',
  billing: '/api/billing',

  // Webhooks
  stripeWebhook: '/api/webhooks/stripe',
  taskWebhook: '/api/webhooks/task-complete',

  // Internal (service-to-service)
  internalTaskStart: '/internal/tasks/start',
  internalTaskCancel: '/internal/tasks/cancel',
  internalWorkerStatus: '/internal/workers/status',
  internalUsageRecord: '/internal/usage/record',
};
