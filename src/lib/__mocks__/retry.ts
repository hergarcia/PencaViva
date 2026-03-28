// Mock withRetry: calls function directly without delay or retries
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

export function isTransientError(): boolean {
  return true;
}
