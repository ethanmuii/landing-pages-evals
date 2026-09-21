import { describe, expect, it } from 'vitest';
import { contractSchema, lockSchema, policySchema } from '../../src/contracts/contract.js';

const policy = { content: true, appearance: true, position: true };
const lock = { lockId: 'footer-legal', baselinePath: 'baselines/footer.html', policy };

describe('global brand contract', () => {
  it('accepts the same lock array without any page or route configuration', () => {
    const contract = [lock, { ...lock, lockId: 'header', baselinePath: 'baselines/header.html' }];
    expect(contractSchema.parse(contract)).toEqual(contract);
  });

  it('requires an array rather than a route-specific object or envelope', () => {
    expect(contractSchema.safeParse({ locks: [lock] }).success).toBe(false);
    expect(contractSchema.safeParse({ '/': [lock] }).success).toBe(false);
  });

  it('preserves exact ID and baseline path values without format restrictions', () => {
    const exact = { ...lock, lockId: '  Footer  ', baselinePath: '  custom baseline  ' };
    expect(lockSchema.parse(exact)).toEqual(exact);
  });

  it.each(['lockId', 'baselinePath', 'policy'])('requires explicit %s', (field) => {
    const incomplete: Record<string, unknown> = { ...lock };
    delete incomplete[field];
    expect(lockSchema.safeParse(incomplete).success).toBe(false);
  });

  it.each(['lockId', 'baselinePath'])('rejects blank or non-string %s', (field) => {
    for (const value of ['', ' \t\n', null, 123]) {
      expect(lockSchema.safeParse({ ...lock, [field]: value }).success).toBe(false);
    }
  });

  it('rejects unknown lock fields, including route overrides', () => {
    expect(contractSchema.safeParse([{ ...lock, routes: ['/'] }]).success).toBe(false);
  });
});

describe('explicit all-enabled policy', () => {
  it('accepts all three literal true values', () => {
    expect(policySchema.parse(policy)).toEqual(policy);
  });

  it.each(['content', 'appearance', 'position'])('requires %s to be explicitly true', (field) => {
    for (const value of [false, undefined, null, 'true', 1]) {
      expect(policySchema.safeParse({ ...policy, [field]: value }).success).toBe(false);
    }
    const incomplete: Record<string, unknown> = { ...policy };
    delete incomplete[field];
    expect(policySchema.safeParse(incomplete).success).toBe(false);
  });

  it('rejects unknown nested policy fields', () => {
    expect(contractSchema.safeParse([{ ...lock, policy: { ...policy, extra: true } }]).success).toBe(false);
  });
});
