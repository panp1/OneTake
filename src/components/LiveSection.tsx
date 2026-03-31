"use client";

import { useEffect, useState, useRef } from "react";

interface LiveSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  accentColor?: string;
  visible: boolean;
  children: React.ReactNode;
  onVisible?: () => void;
}

export default function LiveSection({
  id,
  title,
  subtitle,
  accentColor = "#6B21A8",
  visible,
  children,
  onVisible,
}: LiveSectionProps) {
  const [hasAppeared, setHasAppeared] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && !hasAppeared) {
      setHasAppeared(true);
      onVisible?.();
      // Smooth scroll into view when section first appears
      setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [visible, hasAppeared, onVisible]);

  if (!visible && !hasAppeared) return null;

  return (
    <section
      id={id}
      ref={ref}
      className={`
        scroll-mt-16 transition-all duration-700 ease-out
        ${hasAppeared ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
      `}
    >
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
        {/* Section header with accent bar */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
          <div
            className="w-1 h-8 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--foreground)] tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Section content */}
        <div className="px-6 py-5">{children}</div>
      </div>
    </section>
  );
}
