"use client";

import { use, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  Loader2,
  AlertCircle,
  Globe,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import type { GeneratedAsset, CreativeBrief, ActorProfile } from "@/lib/types";
import AgencyOverviewTab from "@/components/agency/AgencyOverviewTab";
import AgencyChannelsTab from "@/components/agency/AgencyChannelsTab";

// ── Types ─────────────────────────────────────────────

interface AgencyData {
  request: {
    id: string;
    title: string;
    task_type: string;
    target_regions: string[];
    target_languages: string[];
    status: string;
    campaign_slug?: string | null;
  };
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  actors: ActorProfile[];
  strategies: any[];
}

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
    interests?: { hyper?: string[]; hot?: string[]; broad?: string[] };
  };
}

// ── Main Content ──────────────────────────────────────

function AgencyContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [data, setData] = useState<AgencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "channels">("overview");
  const [trackingBaseUrl, setTrackingBaseUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Reuse the designer API endpoint (magic link auth)
        const res = await fetch(`/api/designer/${id}?token=${token}`);
        if (!res.ok) throw new Error("Invalid or expired link");
        const d = await res.json();

        // Fetch strategies
        let strategies: any[] = [];
        try {
          const stratRes = await fetch(`/api/generate/${id}/strategy`);
          if (stratRes.ok) {
            const sd = await stratRes.json();
            strategies = sd.strategies || [];
          }
        } catch { /* strategies optional */ }

        setData({
          request: d.request,
          brief: d.brief,
          assets: d.assets || [],
          actors: d.actors || [],
          strategies,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, token]);

  // Fetch landing page URL for UTM links
  useEffect(() => {
    if (!data) return;
    fetch(`/api/intake/${id}/landing-pages`)
      .then((r) => r.ok ? r.json() : null)
      .then((lp) => {
        if (lp?.landing_page_url) setTrackingBaseUrl(lp.landing_page_url);
        else if (lp?.job_posting_url) setTrackingBaseUrl(lp.job_posting_url);
        // NEVER use ada_form_url
      })
      .catch(() => {});
  }, [data, id]);

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#6B21A8]" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
      <div className="text-center">
        <AlertCircle size={32} className="mx-auto text-red-500 mb-3" />
        <p className="text-base font-medium text-[var(--foreground)]">{error || "Link expired"}</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">Contact the marketing team for a new link.</p>
      </div>
    </div>
  );

  const briefData = (data.brief?.brief_data || {}) as Record<string, any>;
  const personas = (briefData.personas || []) as Persona[];
  const slugFromTitle = data.request.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const campaignSlug = data.request.campaign_slug || slugFromTitle;

  const tabs = [
    { key: "overview" as const, label: "Overview & Strategy", icon: Globe },
    { key: "channels" as const, label: "Channels & Ad Sets", icon: Layers },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFA" }}>
      {/* Gradient bar */}
      <div className="gradient-accent" style={{ height: 4 }} />

      {/* Header */}
      <header style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E5E5", padding: "20px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#6B21A8", marginBottom: 4 }}>
              OneForma Campaign Package
            </p>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>{data.request.title}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: "#F3F4F6", color: "#6B7280" }}>
                {campaignSlug}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 9999, background: "#DCFCE7", color: "#16A34A" }}>
                Approved
              </span>
              <span style={{ fontSize: 12, color: "#737373" }}>
                Package expires in 7 days
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              window.open(`/api/export/${id}?token=${token}&type=composed`, "_blank");
              toast.success("Downloading all creatives...");
            }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 9999, background: "#32373C", color: "#FFFFFF", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            <Download size={16} />
            Download All
          </button>
        </div>
      </header>

      {/* Sticky Tab Bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#FFFFFF", borderBottom: "1px solid #E5E5E5" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 0 }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "14px 24px",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#1A1A1A" : "#737373",
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #32373C" : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 32px" }}>
        {activeTab === "overview" && (
          <AgencyOverviewTab personas={personas} />
        )}
        {activeTab === "channels" && (
          <AgencyChannelsTab
            assets={data.assets}
            personas={personas}
            campaignSlug={campaignSlug}
            trackingBaseUrl={trackingBaseUrl}
            strategiesSummary={briefData.campaign_strategies_summary || null}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #E5E5E5", background: "#FFFFFF", padding: "16px 32px", marginTop: 48, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: "#737373", margin: 0 }}>
          OneForma Creative Package &middot; Generated by Nova
        </p>
        <p style={{ fontSize: 12, color: "#A3A3A3", margin: "4px 0 0" }}>
          Package expires in 7 days
        </p>
      </footer>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────

export default function AgencyPortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-[#6B21A8]" /></div>}>
      <AgencyContent id={id} />
    </Suspense>
  );
}
