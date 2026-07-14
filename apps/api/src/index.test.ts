import { describe, it, expect } from 'vitest';
import { applyPlanLimits, getPlanLimits } from './config/plans.js';
import { hashPassword, verifyPassword, generateApiKey, verifyApiKey } from './lib/crypto.js';

describe('plans', () => {
  it('applies free plan limits', () => {
    const limits = applyPlanLimits('free');
    expect(limits.aiCallsLimit).toBe(10);
    expect(limits.deviceLimit).toBe(1);
  });

  it('applies pro plan limits', () => {
    const limits = applyPlanLimits('pro');
    expect(limits.aiCallsLimit).toBe(2000);
    expect(limits.connectorLimit).toBe(3);
  });

  it('exposes raw plan config', () => {
    expect(getPlanLimits('starter').aiCalls).toBe(200);
  });
});

describe('crypto', () => {
  it('hashes and verifies passwords', () => {
    const hash = hashPassword('test-password-123');
    expect(verifyPassword('test-password-123', hash)).toBe(true);
    expect(verifyPassword('wrong', hash)).toBe(false);
  });

  it('generates verifiable API keys', () => {
    const { key, hash } = generateApiKey();
    expect(key.startsWith('fk_')).toBe(true);
    expect(verifyApiKey(key, hash)).toBe(true);
  });
});
