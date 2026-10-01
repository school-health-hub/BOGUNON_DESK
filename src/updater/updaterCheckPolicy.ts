export const STARTUP_UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000;

export const shouldRunStartupCheck = (
  lastCheckedAt: number | null,
  now: number,
): boolean => lastCheckedAt === null || now - lastCheckedAt >= STARTUP_UPDATE_CHECK_INTERVAL_MS;
