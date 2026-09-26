import { describe, expect, it } from 'vitest';

import {
  buildInsufficientUsdcCardCopy,
  formatUsdcShortfall,
  getInsufficientUsdcCardCopy,
  getInsufficientUsdcCopy,
} from './copy';

describe('card copy', () => {
  it('returns the expected insufficient USDC copy for a shortfall amount', () => {
    const copy = getInsufficientUsdcCopy(12.5);

    expect(copy).not.toBeNull();
    expect(copy?.headline).toBe('Insufficient USDC balance');
    expect(copy?.shortfall).toBe('You need $12.50 more USDC to complete this swap.');
    expect(copy?.nextStep).toBe('Lower the amount and try again.');
  });

  it('supports the common object shapes produced by fee helpers', () => {
    expect(getInsufficientUsdcCopy({ insufficient: true, shortfallUsdc: '5.25' })).toEqual({
      kind: 'insufficient_usdc',
      headline: 'Insufficient USDC balance',
      shortfall: 'You need $5.25 more USDC to complete this swap.',
      nextStep: 'Lower the amount and try again.',
    });

    expect(getInsufficientUsdcCardCopy({ insufficient: false, shortfall: '0.00' })).toBeNull();
  });

  it('formats the shortfall amount consistently', () => {
    expect(formatUsdcShortfall('12.5')).toBe('$12.50');
    expect(buildInsufficientUsdcCardCopy('0')).toBeNull();
  });
});
