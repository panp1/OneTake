"use client";

import { useRef, useState, useCallback } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Debounced autosave hook for asset field updates.
 *
 * Usage:
 *   const { save, status } = useAutosave(assetId, "content", "overlay_headline");
 *   <EditableField onSave={save} />
 *   <AutosaveStatus status={status} />
 */
export function useAutosave(
  assetId: string,
  field: "content" | "copy_data",
  key: string,
  debounceMs: number = 800,
): {
  save: (value: string) => void;
  status: AutosaveStatus;
} {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (value: string) => {
      // Clear any pending debounce
      if (timerRef.current) clearTimeout(timerRef.current);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);

      timerRef.current = setTimeout(async () => {
        setStatus("saving");

        try {
          const res = await fetch(`/api/assets/${assetId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: { [key]: value } }),
          });

          if (!res.ok) {
            setStatus("error");
            return;
          }

          setStatus("saved");
          // Revert to idle after 2 seconds
          revertTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
        } catch {
          setStatus("error");
        }
      }, debounceMs);
    },
    [assetId, field, key, debounceMs],
  );

  return { save, status };
}
