// ===========================================
// User & Auth Types
// ===========================================

export interface User {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  stripeCustomerId?: string;
  apiKey?: string;
  created: string;
  updated: string;
}

// ===========================================
// Subscription Types
// ===========================================

export type PlanType = 'free' | 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface PlanLimits {
  tasksPerMonth: number;
  maxConcurrent: number;
  maxDurationSeconds: number;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: PlanType;
  status: SubscriptionStatus;
  stripeSubscriptionId?: string;
  currentPeriodEnd: string;
  limits: PlanLimits;
  created: string;
  updated: string;
}

// ===========================================
// Task Types
// ===========================================

export type TaskStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface TaskInput {
  [key: string]: unknown;
}

export interface TaskOutput {
  [key: string]: unknown;
}

export interface ResourceUsage {
  cpuSeconds: number;
  memoryMbSeconds: number;
  durationSeconds: number;
}

export interface Task {
  id: string;
  userId: string;
  type: string;
  status: TaskStatus;
  input: TaskInput;
  output?: TaskOutput;
  error?: string;
  workerId?: string;
  startedAt?: string;
  completedAt?: string;
  resourceUsage?: ResourceUsage;
  created: string;
  updated: string;
}

export interface CreateTaskRequest {
  type: string;
  input: TaskInput;
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  output?: TaskOutput;
  error?: string;
  resourceUsage?: ResourceUsage;
}

// ===========================================
// Usage & Billing Types
// ===========================================

export interface UsageRecord {
  id: string;
  userId: string;
  taskId?: string;
  period: string; // "2024-01"
  cpuSeconds: number;
  memoryMbSeconds: number;
  taskCount: number;
  costCents: number;
  created: string;
}

export interface UsageSummary {
  period: string;
  totalTasks: number;
  totalCpuSeconds: number;
  totalMemoryMbSeconds: number;
  totalCostCents: number;
  limit: number;
  remaining: number;
}

// ===========================================
// Worker Types
// ===========================================

export interface WorkerConfig {
  image: string;
  cpuLimit?: number;
  memoryLimit?: string;
  timeoutSeconds?: number;
  environment?: Record<string, string>;
}

export interface WorkerStatus {
  id: string;
  taskId: string;
  containerId: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped';
  startedAt: string;
  resourceUsage?: ResourceUsage;
}

// ===========================================
// API Types
// ===========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

// ===========================================
// Webhook Types
// ===========================================

export interface TaskWebhookPayload {
  event: 'task.completed' | 'task.failed';
  taskId: string;
  userId: string;
  result: TaskResult;
  timestamp: string;
}

export interface StripeWebhookEvent {
  type: string;
  data: {
    object: unknown;
  };
}
