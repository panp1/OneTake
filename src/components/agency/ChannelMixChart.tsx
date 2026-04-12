"use client";

interface Persona {
  persona_name?: string;
  best_channels?: string[];
  targeting_profile?: {
    budget_weight_pct?: number;
  };
}

interface ChannelMixChartProps {
  personas: Persona[];
}

interface ChannelAlloc {
  channel: string;
  pct: number;
}

function computeChannelMix(personas: Persona[]): ChannelAlloc[] {
  const totals = new Map<string, number>();
  for (const p of personas) {
    const weight = p.targeting_profile?.budget_weight_pct ?? 0;
    const channels = p.best_channels ?? [];
    if (channels.length === 0 || weight === 0) continue;
    const perChannel = weight / channels.length;
    for (const ch of channels) {
      const label = ch.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      totals.set(label, (totals.get(label) ?? 0) + perChannel);
    }
  }
  return [...totals.entries()]
    .map(([channel, pct]) => ({ channel, pct: Math.round(pct) }))
    .sort((a, b) => b.pct - a.pct);
}

const BAR_SHADES = ["#32373C", "#555555", "#737373", "#999999", "#B0B0B0", "#CCCCCC"];

export default function ChannelMixChart({ personas }: ChannelMixChartProps) {
  const mix = computeChannelMix(personas);
  if (mix.length === 0) return null;
  const max = mix[0].pct;

  return (
    <div style={{ padding: 18 }}>
      {mix.map((entry, i) => (
        <div key={entry.channel} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, width: 100, textAlign: "right" as const, color: "#1A1A1A" }}>
            {entry.channel}
          </div>
          <div style={{ flex: 1, height: 28, background: "#F7F7F8", borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.max((entry.pct / max) * 100, 8)}%`,
                background: BAR_SHADES[Math.min(i, BAR_SHADES.length - 1)],
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                paddingLeft: 10,
                fontSize: 10,
                fontWeight: 700,
                color: "white",
                minWidth: 28,
              }}
            >
              {entry.pct}%
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, width: 36, textAlign: "right" as const }}>{entry.pct}%</div>
        </div>
      ))}
    </div>
  );
}
