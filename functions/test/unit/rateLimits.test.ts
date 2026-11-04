import { describe, expect, it } from 'vitest';
import { DAY_MS, ts } from '../../src/lib/firestore';
import { rateLimitKey, takeWindow } from '../../src/lib/rateLimits';

const NOW = Date.UTC(2026, 10, 6, 10, 0, 0);
const HOUR = 3_600_000;

describe('takeWindow', () => {
  it('starts a window at the first take and fills it up to the limit', () => {
    const limit = { limit: 2, windowMs: HOUR };
    const first = takeWindow(undefined, NOW, limit);
    expect(first).toEqual({ count: 1, windowStart: ts(NOW), expiresAt: ts(NOW + DAY_MS) });
    const second = takeWindow(first!, NOW + HOUR - 1, limit);
    expect(second).toEqual({ count: 2, windowStart: ts(NOW), expiresAt: ts(NOW + DAY_MS) });
    expect(takeWindow(second!, NOW + HOUR - 1, limit)).toBeNull();
    expect(takeWindow(second!, NOW + HOUR, limit)).toEqual({ count: 1, windowStart: ts(NOW + HOUR), expiresAt: ts(NOW + HOUR + DAY_MS) });
  });

  it('works as a throttle with a limit of one', () => {
    const throttle = { limit: 1, windowMs: 10 * 60_000 };
    const slot = takeWindow(undefined, NOW, throttle)!;
    expect(takeWindow(slot, NOW + 10 * 60_000 - 1, throttle)).toBeNull();
    expect(takeWindow(slot, NOW + 10 * 60_000, throttle)?.windowStart).toEqual(ts(NOW + 10 * 60_000));
  });
});

describe('rateLimitKey', () => {
  it('scopes a bucket to a user and optionally a pod', () => {
    expect(rateLimitKey('uid1', 'chat', 'abcdefghijklmnopqrst')).toBe('uid1_chat_abcdefghijklmnopqrst');
    expect(rateLimitKey('uid1', 'export')).toBe('uid1_export');
  });
});
