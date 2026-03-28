// Non-transient error patterns — these should not be retried
const NON_TRANSIENT_PATTERNS = [
  "row-level security",
  "already_member",
  "group_not_found",
  "group_full",
  "invalid",
  "required",
  "not found",
  "unauthorized",
  "forbidden",
] as const;

export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const msg = error.message.toLowerCase();
  return !NON_TRANSIENT_PATTERNS.some((pattern) => msg.includes(pattern));
}

export type RetryOptions = {
  maxRetries?: number;
  baseDelay?: number;
  shouldRetry?: (error: unknown) => boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const baseDelay = options?.baseDelay ?? 1000;
  const shouldRetry = options?.shouldRetry ?? isTransientError;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      await delay(baseDelay * Math.pow(2, attempt));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw lastError;
}
