export const PLAN_LIMITS = {
  free: { aiCalls: 10, seats: 1, connectors: 0, devices: 1, exports: 50 },
  starter: { aiCalls: 200, seats: 1, connectors: 1, devices: 1, exports: 500 },
  pro: { aiCalls: 2000, seats: 3, connectors: 3, devices: 2, exports: 5000 },
  team: { aiCalls: 10000, seats: 10, connectors: 10, devices: 10, exports: 50000 },
  enterprise: { aiCalls: 100000, seats: 100, connectors: 100, devices: 100, exports: 1000000 },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

/** Maps plan config to Organization model fields */
export function applyPlanLimits(plan: PlanId) {
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  return {
    seats: limits.seats,
    aiCallsLimit: limits.aiCalls,
    connectorLimit: limits.connectors,
    deviceLimit: limits.devices,
  };
}

export function getPlanLimits(plan: PlanId) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}
