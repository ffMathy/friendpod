/** Messages per user per pod per hour; the next one fails with `resource-exhausted/RATE_LIMITED`. */
export const CHAT_RATE_LIMIT_PER_HOUR = 30;

/** At most one generic "New message in your pod" push per member per pod in this interval. */
export const CHAT_PUSH_THROTTLE_MS = 10 * 60_000;
