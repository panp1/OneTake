"use client";

import { useState, useEffect } from "react";
import { Trophy, MousePointerClick, Link2, Megaphone } from "lucide-react";

interface LeaderboardEntry {
  recruiter_clerk_id: string;
  recruiter_name: string;
  total_clicks: number;
  links_created: number;
  best_link_clicks: number;
  campaigns_active: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
}

const MEDAL_COLORS = ["#f59e0b", "#9ca3af", "#b45309"];

export default function RecruiterLeaderboardWidget({ config }: { config: Record<string, unknown> }) {
  void config;
  const [data, setData] = useState<LeaderboardData | null>(null);

  useEffect(() => {
    fetch("/api/insights/metrics/recruiter-leaderboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.leaderboard?.length) {
    return <div className="flex items-center justify-center h-full text-sm text-[var(--muted-foreground)]">No recruiter data yet</div>;
  }

  return (
    <div className="flex flex-col gap-2 overflow-auto h-full">
      {data.leaderboard.map((entry, i) => (
        <div
          key={entry.recruiter_clerk_id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
        >
          <div className="w-7 h-7 flex items-center justify-center shrink-0">
            {i < 3 ? (
              <Trophy className="w-5 h-5" style={{ color: MEDAL_COLORS[i] }} />
            ) : (
              <span className="text-sm font-semibold text-[var(--muted-foreground)]">{i + 1}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--foreground)] truncate">
              {entry.recruiter_name || "Unknown Recruiter"}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)] mt-0.5">
              <span className="flex items-center gap-1">
                <Link2 className="w-3 h-3" /> {entry.links_created} links
              </span>
              <span className="flex items-center gap-1">
                <Megaphone className="w-3 h-3" /> {entry.campaigns_active} campaigns
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <MousePointerClick className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <span className="text-sm font-bold text-[var(--foreground)]">{entry.total_clicks}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
