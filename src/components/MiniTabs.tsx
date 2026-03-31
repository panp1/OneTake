"use client";

import { useState } from "react";

interface MiniTab {
  key: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

interface MiniTabsProps {
  tabs: MiniTab[];
  defaultTab?: string;
}

export default function MiniTabs({ tabs, defaultTab }: MiniTabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.key || "");

  const activeTab = tabs.find((t) => t.key === active);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[var(--border)] mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`
              px-3 py-2 text-[12px] font-medium cursor-pointer transition-all relative
              ${active === tab.key
                ? "text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                  active === tab.key
                    ? "bg-[#6B21A8]/10 text-[#6B21A8]"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                {tab.count}
              </span>
            )}
            {/* Active indicator */}
            {active === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6B21A8] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[60px]">
        {activeTab?.content}
      </div>
    </div>
  );
}
