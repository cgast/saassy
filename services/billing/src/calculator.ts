import {
  RESOURCE_PRICES,
  OVERAGE_PRICE_CENTS,
  PLAN_LIMITS,
  type PlanType,
  type ResourceUsage,
} from '@saassy/shared';

export interface UsageSummary {
  period: string;
  totalTasks: number;
  totalCpuSeconds: number;
  totalMemoryMbSeconds: number;
  baseCostCents: number;
  resourceCostCents: number;
  overageCostCents: number;
  totalCostCents: number;
}

export function calculateResourceCost(usage: ResourceUsage): number {
  const cpuCost = usage.cpuSeconds * RESOURCE_PRICES.cpuSecondCents;
  const memoryCost = usage.memoryMbSeconds * RESOURCE_PRICES.memoryMbSecondCents;
  return Math.ceil(cpuCost + memoryCost);
}

export function calculateTaskOverage(
  plan: PlanType,
  taskCount: number
): { overageCount: number; overageCostCents: number } {
  const limits = PLAN_LIMITS[plan];
  const includedTasks = limits.tasksPerMonth;

  // Unlimited tasks
  if (includedTasks === -1) {
    return { overageCount: 0, overageCostCents: 0 };
  }

  const overageCount = Math.max(0, taskCount - includedTasks);
  const overageCostCents = overageCount * OVERAGE_PRICE_CENTS[plan];

  return { overageCount, overageCostCents };
}

export function calculateUsageSummary(
  plan: PlanType,
  usageRecords: Array<{
    cpuSeconds: number;
    memoryMbSeconds: number;
    taskCount: number;
  }>
): UsageSummary {
  // Aggregate usage
  const totals = usageRecords.reduce(
    (acc, record) => ({
      totalTasks: acc.totalTasks + record.taskCount,
      totalCpuSeconds: acc.totalCpuSeconds + record.cpuSeconds,
      totalMemoryMbSeconds: acc.totalMemoryMbSeconds + record.memoryMbSeconds,
    }),
    { totalTasks: 0, totalCpuSeconds: 0, totalMemoryMbSeconds: 0 }
  );

  // Calculate costs
  const resourceCostCents = calculateResourceCost({
    cpuSeconds: totals.totalCpuSeconds,
    memoryMbSeconds: totals.totalMemoryMbSeconds,
    durationSeconds: 0, // Not used for cost calculation
  });

  const { overageCostCents } = calculateTaskOverage(plan, totals.totalTasks);

  // Base cost is the plan price (handled by Stripe subscription)
  const baseCostCents = 0;

  return {
    period: new Date().toISOString().slice(0, 7),
    ...totals,
    baseCostCents,
    resourceCostCents,
    overageCostCents,
    totalCostCents: baseCostCents + resourceCostCents + overageCostCents,
  };
}

export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
