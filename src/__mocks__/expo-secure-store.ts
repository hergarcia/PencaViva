const store: Record<string, string> = {};

export function getItem(key: string): string | null {
  return store[key] ?? null;
}

export function setItem(key: string, value: string): void {
  store[key] = value;
}

export function deleteItem(key: string): void {
  delete store[key];
}

export async function deleteItemAsync(key: string): Promise<void> {
  delete store[key];
}

/** Test helper — clears all stored values. */
export function __resetStore(): void {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
}
