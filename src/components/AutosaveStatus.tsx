"use client";

import type { AutosaveStatus as Status } from "@/hooks/useAutosave";

const STATUS_CONFIG: Record<Status, { dot: string; text: string; label: string }> = {
  idle: { dot: "bg-transparent", text: "text-transparent", label: "" },
  saving: { dot: "bg-[#d97706]", text: "text-[#d97706]", label: "Saving..." },
  saved: { dot: "bg-[#16a34a]", text: "text-[#16a34a]", label: "All changes saved" },
  error: { dot: "bg-[#dc2626]", text: "text-[#dc2626]", label: "Save failed — click to retry" },
};

interface AutosaveStatusProps {
  status: Status;
  onRetry?: () => void;
}

export default function AutosaveStatus({ status, onRetry }: AutosaveStatusProps) {
  if (status === "idle") return null;

  const config = STATUS_CONFIG[status];

  return (
    <div
      className={`flex items-center gap-1.5 ${status === "error" ? "cursor-pointer" : ""}`}
      onClick={status === "error" ? onRetry : undefined}
    >
      <div className={`w-[7px] h-[7px] rounded-full ${config.dot}`} />
      <span className={`text-[11px] font-medium ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}
