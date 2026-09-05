import { useCallback, useEffect, useRef } from "react";
import { ApiError } from "@/utils/apiClient";

interface UsePreferenceSyncParams<TPayload> {
  enabled: boolean;
  token: string | null;
  payload: TPayload;
  persist: (token: string, payload: TPayload) => Promise<unknown>;
  onNonRateLimitError?: () => void;
  debounceMs?: number;
  minIntervalMs?: number;
  cooldownOn429Ms?: number;
}

export function isRateLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}

export function usePreferenceSync<TPayload>({
  enabled,
  token,
  payload,
  persist,
  onNonRateLimitError,
  debounceMs = 1200,
  minIntervalMs = 2500,
  cooldownOn429Ms = 60000,
}: UsePreferenceSyncParams<TPayload>) {
  // Tracks the last payload we know is persisted to avoid duplicate writes.
  const lastPersistedSnapshotRef = useRef<string | null>(null);
  // Ensures writes are spaced out even when UI changes rapidly.
  const lastPersistAtRef = useRef(0);
  // Adds a temporary retry cooldown after a 429 response.
  const blockedUntilRef = useRef(0);

  const setPersistedSnapshot = useCallback((snapshot: string) => {
    lastPersistedSnapshotRef.current = snapshot;
  }, []);

  useEffect(() => {
    if (!enabled || !token) {
      return;
    }

    const payloadSnapshot = JSON.stringify(payload);
    if (payloadSnapshot === lastPersistedSnapshotRef.current) {
      return;
    }

    const now = Date.now();
    const minIntervalReadyInMs = Math.max(0, lastPersistAtRef.current + minIntervalMs - now);
    const cooldownReadyInMs = Math.max(0, blockedUntilRef.current - now);
    const timeoutMs = Math.max(debounceMs, minIntervalReadyInMs, cooldownReadyInMs);

    const timeoutId = window.setTimeout(() => {
      lastPersistAtRef.current = Date.now();

      void persist(token, payload)
        .then(() => {
          lastPersistedSnapshotRef.current = payloadSnapshot;
        })
        .catch((persistError) => {
          if (isRateLimitError(persistError)) {
            blockedUntilRef.current = Date.now() + cooldownOn429Ms;
            console.warn("Preference sync was rate-limited. Cooldown enabled before next retry.");
            return;
          }

          onNonRateLimitError?.();
        });
    }, timeoutMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    enabled,
    token,
    payload,
    persist,
    onNonRateLimitError,
    debounceMs,
    minIntervalMs,
    cooldownOn429Ms,
  ]);

  return { setPersistedSnapshot };
}
