"use client";

import { useEffect, useState } from 'react';
import { Unplug } from 'lucide-react';

export default function SkillDistributionWidget({ config }: { config: Record<string, unknown> }) {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/audienceiq/crm/status').then(r => r.json()).then(s => setConnected(s.connected)).catch(() => setConnected(false));
  }, []);

  if (connected === null) return <div className="h-full skeleton rounded-lg" />;

  if (!connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Unplug className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">CRM Not Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Set CRM_DATABASE_URL to enable skill distribution analysis</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
      <div className="w-12 h-12 rounded-2xl gradient-accent flex items-center justify-center">
        <span className="text-white text-lg font-bold">IQ</span>
      </div>
      <p className="text-xs font-semibold text-[var(--foreground)]">Skill Analysis Ready</p>
      <p className="text-[10px] text-[var(--muted-foreground)]">CRM connected. Select a campaign to compare declared vs actual contributor skills.</p>
    </div>
  );
}
