"use client";

import ChannelMixChart from "./ChannelMixChart";

interface Persona {
  persona_name?: string;
  name?: string;
  archetype_key?: string;
  age_range?: string;
  region?: string;
  best_channels?: string[];
  targeting_profile?: {
    budget_weight_pct?: number;
    estimated_pool_size?: string;
    expected_cpl_tier?: string;
    demographics?: { occupation?: string; gender?: string };
  };
}

interface AgencyOverviewTabProps {
  personas: Persona[];
  pillarPrimary?: string | null;
  pillarSecondary?: string | null;
}

export default function AgencyOverviewTab({ personas }: AgencyOverviewTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Channel Mix */}
      <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E8EA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Channel Mix & Budget Split</div>
            <div style={{ fontSize: 11, color: "#8A8A8E" }}>Recommended allocation based on persona targeting</div>
          </div>
        </div>
        <ChannelMixChart personas={personas} />
      </div>

      {/* Persona Overview */}
      <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E8EA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Persona Overview</div>
          <div style={{ fontSize: 11, color: "#8A8A8E" }}>{personas.length} target personas</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(personas.length, 3)}, 1fr)`, gap: 14, padding: 18 }}>
          {personas.map((p, i) => {
            const tp = p.targeting_profile ?? {};
            const demo = tp.demographics ?? {};
            const channels = p.best_channels ?? [];
            const name = p.persona_name || p.name || p.archetype_key?.replace(/_/g, " ") || `Persona ${i + 1}`;
            return (
              <div key={i} style={{ border: "1px solid #E8E8EA", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: "#1A1A1A" }}>{name}</div>
                <div style={{ fontSize: 11, color: "#8A8A8E", marginBottom: 10, lineHeight: 1.4 }}>
                  {[p.age_range, p.region, demo.occupation].filter(Boolean).join(" · ")}
                </div>
                <StatRow label="Budget Weight" value={tp.budget_weight_pct ? `${tp.budget_weight_pct}%` : "—"} />
                <StatRow label="Pool Size" value={tp.estimated_pool_size ?? "—"} />
                <StatRow label="Expected CPL" value={tp.expected_cpl_tier ?? "—"} />
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                  {channels.map((ch) => (
                    <span key={ch} style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: "#F7F7F8", color: "#32373C", border: "1px solid #E8E8EA" }}>
                      {ch.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid #F7F7F8" }}>
      <span style={{ fontSize: 11, color: "#8A8A8E" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#1A1A1A" }}>{value}</span>
    </div>
  );
}
