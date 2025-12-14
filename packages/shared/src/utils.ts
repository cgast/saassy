import { RESOURCE_PRICES, OVERAGE_PRICE_CENTS, PLAN_LIMITS } from './constants.js';
import type { PlanType, ResourceUsage } from './types.js';

// ===========================================
// ID Generation
// ===========================================

export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'sk_';
  let key = prefix;
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ===========================================
// Cost Calculation
// ===========================================

export function calculateResourceCost(usage: ResourceUsage): number {
  const cpuCost = usage.cpuSeconds * RESOURCE_PRICES.cpuSecondCents;
  const memoryCost = usage.memoryMbSeconds * RESOURCE_PRICES.memoryMbSecondCents;
  return Math.ceil(cpuCost + memoryCost);
}

export function calculateOverageCost(
  plan: PlanType,
  tasksUsed: number,
  tasksIncluded: number
): number {
  const overage = Math.max(0, tasksUsed - tasksIncluded);
  return overage * OVERAGE_PRICE_CENTS[plan];
}

// ===========================================
// Plan Validation
// ===========================================

export function canCreateTask(
  plan: PlanType,
  currentMonthTasks: number,
  currentConcurrent: number
): { allowed: boolean; reason?: string } {
  const limits = PLAN_LIMITS[plan];

  // Check monthly limit (unlimited if -1)
  if (limits.tasksPerMonth !== -1 && currentMonthTasks >= limits.tasksPerMonth) {
    // Allow overage for paid plans
    if (plan === 'free') {
      return { allowed: false, reason: 'Monthly task limit reached. Upgrade to continue.' };
    }
  }

  // Check concurrent limit
  if (currentConcurrent >= limits.maxConcurrent) {
    return { allowed: false, reason: `Maximum concurrent tasks (${limits.maxConcurrent}) reached.` };
  }

  return { allowed: true };
}

// ===========================================
// Date Utilities
// ===========================================

export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

// ===========================================
// Validation
// ===========================================

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidApiKey(key: string): boolean {
  return key.startsWith('sk_') && key.length === 35;
}

// ===========================================
// Error Handling
// ===========================================

export class SaasyError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'SaasyError';
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  TASK_LIMIT_REACHED: 'TASK_LIMIT_REACHED',
  CONCURRENT_LIMIT_REACHED: 'CONCURRENT_LIMIT_REACHED',
  INVALID_INPUT: 'INVALID_INPUT',
  WORKER_ERROR: 'WORKER_ERROR',
  BILLING_ERROR: 'BILLING_ERROR',
} as const;
