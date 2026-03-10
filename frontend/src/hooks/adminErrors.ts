export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function isAuthFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("unauthorized") || normalized.includes("not authenticated") || normalized.includes("admin access required");
}
