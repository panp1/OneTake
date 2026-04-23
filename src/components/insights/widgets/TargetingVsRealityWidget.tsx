"use client";

import { useEffect, useState } from 'react';
import { Unplug, MapPin, Languages, Wrench } from 'lucide-react';

interface TvRData {
  declared_regions: { name: string; count: number }[];
  declared_languages: { name: string; count: number }[];
  actual_regions: { name: string; count: number }[];
  actual_languages: { name: string; count: number }[];
  actual_skills: { skill: string; count: number }[];
}

export default function TargetingVsRealityWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<TvRData | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const requestId = config.requestId as string;

  useEffect(() => {
    fetch('/api/audienceiq/crm/status').then(r => r.json()).then(s => setConnected(s.connected)).catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (!requestId || connected !== true) return;
    // TODO: Need a dedicated targeting-vs-reality API endpoint
    // For now this widget shows the CRM-ready state
  }, [requestId, connected]);

  if (connected === null) return <div className="h-full skeleton rounded-lg" />;

  if (!connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Unplug className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">CRM Not Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Set CRM_DATABASE_URL to compare targeting vs reality</p>
      </div>
    );
  }

  if (!requestId) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">
        Configure a campaign in widget settings to see targeting vs reality
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <div className="w-12 h-12 rounded-2xl gradient-accent flex items-center justify-center">
          <span className="text-white text-lg font-bold">vs</span>
        </div>
        <p className="text-xs font-semibold text-[var(--foreground)]">Targeting vs Reality</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">CRM connected. Comparison data will appear once contributors are synced for this campaign.</p>
      </div>
    );
  }

  const ComparisonRow = ({ label, icon: Icon, declared, actual }: {
    label: string;
    icon: typeof MapPin;
    declared: { name: string; count: number }[];
    actual: { name: string; count: number }[];
  }) => (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[9px] font-medium text-[var(--muted-foreground)] mb-1">DECLARED (Targeting)</div>
          <div className="space-y-1">
            {declared.slice(0, 5).map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-[#0693e3]" />
                <span className="text-[var(--foreground)]">{d.name}</span>
              </div>
            ))}
            {declared.length === 0 && <span className="text-[10px] text-[var(--muted-foreground)]">None declared</span>}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-medium text-[var(--muted-foreground)] mb-1">ACTUAL (CRM)</div>
          <div className="space-y-1">
            {actual.slice(0, 5).map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-[#9b51e0]" />
                <span className="text-[var(--foreground)]">{d.name}</span>
                <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">{d.count}</span>
              </div>
            ))}
            {actual.length === 0 && <span className="text-[10px] text-[var(--muted-foreground)]">No CRM data yet</span>}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-auto space-y-5 p-1">
      <ComparisonRow label="Regions" icon={MapPin} declared={data.declared_regions} actual={data.actual_regions} />
      <ComparisonRow label="Languages" icon={Languages} declared={data.declared_languages} actual={data.actual_languages} />
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          <Wrench className="w-3 h-3" /> Skills (CRM Only)
        </div>
        <div className="space-y-1">
          {data.actual_skills.slice(0, 8).map(s => (
            <div key={s.skill} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
              <span className="text-[var(--foreground)] flex-1">{s.skill}</span>
              <span className="text-[10px] text-[var(--muted-foreground)]">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
