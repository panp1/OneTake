"use client";

import { useRef, useState, useCallback } from "react";

export type StrategyAutosaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave for strategy_data JSONB.
 * Sends the full strategy_data object on each save — no partial update logic.
 */
export function useStrategyAutosave(
  requestId: string,
  strategyId: string,
  debounceMs: number = 800,
): {
  save: (strategyData: Record<string, unknown>) => void;
  status: StrategyAutosaveStatus;
} {
  const [status, setStatus] = useState<StrategyAutosaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (strategyData: Record<string, unknown>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);

      setStatus("saving");

      timerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/generate/${requestId}/strategy`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              strategy_id: strategyId,
              strategy_data: strategyData,
            }),
          });

          if (!res.ok) {
            setStatus("error");
            return;
          }

          setStatus("saved");
          revertTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
        } catch {
          setStatus("error");
        }
      }, debounceMs);
    },
    [requestId, strategyId, debounceMs],
  );

  return { save, status };
}
