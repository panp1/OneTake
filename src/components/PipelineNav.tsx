"use client";

import { CheckCircle2, Loader2, Circle, AlertCircle } from "lucide-react";

export interface PipelineStage {
  key: string;
  label: string;
  status: "pending" | "running" | "passed" | "failed" | "retrying";
}

interface PipelineNavProps {
  stages: PipelineStage[];
  activeSection?: string;
  onNavigate?: (key: string) => void;
}

const statusConfig = {
  pending: {
    Icon: Circle,
    color: "text-[var(--muted-foreground)]",
    bg: "bg-transparent",
    border: "border-[var(--border)]",
    line: "bg-[var(--border)]",
  },
  running: {
    Icon: Loader2,
    color: "text-[#0693E3]",
    bg: "bg-[#0693E3]/5",
    border: "border-[#0693E3]/30",
    line: "bg-[#0693E3]/30",
    animate: true,
  },
  passed: {
    Icon: CheckCircle2,
    color: "text-[#22c55e]",
    bg: "bg-[#22c55e]/5",
    border: "border-[#22c55e]/30",
    line: "bg-[#22c55e]/40",
  },
  failed: {
    Icon: AlertCircle,
    color: "text-[#ef4444]",
    bg: "bg-[#ef4444]/5",
    border: "border-[#ef4444]/30",
    line: "bg-[#ef4444]/30",
  },
  retrying: {
    Icon: Loader2,
    color: "text-[#f59e0b]",
    bg: "bg-[#f59e0b]/5",
    border: "border-[#f59e0b]/30",
    line: "bg-[#f59e0b]/30",
    animate: true,
  },
};

export default function PipelineNav({
  stages,
  activeSection,
  onNavigate,
}: PipelineNavProps) {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[var(--border)] px-6 py-3">
      <div className="flex items-center gap-0 max-w-4xl mx-auto">
        {stages.map((stage, i) => {
          const config = statusConfig[stage.status];
          const isActive = activeSection === stage.key;
          const Icon = config.Icon;

          return (
            <div key={stage.key} className="flex items-center flex-1 last:flex-none">
              {/* Stage indicator */}
              <button
                onClick={() => onNavigate?.(stage.key)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                  transition-all cursor-pointer whitespace-nowrap
                  border ${config.border} ${config.bg}
                  ${isActive ? "ring-2 ring-[#6B21A8]/20 shadow-sm" : ""}
                  ${config.color}
                `}
              >
                <Icon
                  size={14}
                  className={`flex-shrink-0 ${"animate" in config && config.animate ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">{stage.label}</span>
              </button>

              {/* Connector line */}
              {i < stages.length - 1 && (
                <div className={`flex-1 h-[2px] mx-1 rounded-full ${config.line}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
