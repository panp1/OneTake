"use client";

export default function TextNoteWidget({ config }: { config: Record<string, unknown> }) {
  return (
    <div className="h-full p-1 text-sm text-[var(--foreground)] whitespace-pre-wrap">
      {(config.text as string) || "Click edit to add notes..."}
    </div>
  );
}
