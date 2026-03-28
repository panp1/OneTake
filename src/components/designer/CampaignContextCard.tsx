"use client";

import { Users, Palette, AlertTriangle, Globe } from "lucide-react";
import type { IntakeRequest, CreativeBrief } from "@/lib/types";

interface CampaignContextCardProps {
  request: IntakeRequest;
  brief: CreativeBrief | null;
}

function extractPersonas(brief: CreativeBrief | null): string[] {
  if (!brief?.brief_data) return [];
  const bd = brief.brief_data as Record<string, unknown>;
  // Try common brief_data shapes
  if (Array.isArray(bd.personas)) {
    return (bd.personas as Array<Record<string, string>>).map(
      (p) => p.name || p.archetype || String(p)
    );
  }
  if (Array.isArray(bd.target_personas)) {
    return (bd.target_personas as Array<Record<string, string>>).map(
      (p) => p.name || p.archetype || String(p)
    );
  }
  if (typeof bd.target_audience === "string") {
    return [bd.target_audience];
  }
  return [];
}

function extractField(brief: CreativeBrief | null, ...keys: string[]): string {
  if (!brief) return "";
  const sources = [brief.brief_data, brief.design_direction] as Record<string, unknown>[];
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const val = source[key];
      if (typeof val === "string" && val.trim()) return val;
    }
  }
  return "";
}

function extractList(brief: CreativeBrief | null, ...keys: string[]): string[] {
  if (!brief) return [];
  const sources = [brief.brief_data, brief.design_direction] as Record<string, unknown>[];
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      const val = source[key];
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === "string" && val.trim()) {
        return val.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
      }
    }
  }
  return [];
}

export default function CampaignContextCard({ request, brief }: CampaignContextCardProps) {
  const personas = extractPersonas(brief);
  const tone = extractField(brief, "tone", "tone_of_voice", "brand_tone");
  const style = extractField(brief, "visual_style", "style", "art_style", "photography_style");
  const doNotList = extractList(brief, "do_not", "avoid", "restrictions", "negative_prompts");
  const culturalNotes = extractField(brief, "cultural_notes", "cultural_context", "localization_notes");
  const objective = extractField(brief, "objective", "campaign_objective", "goal", "brief_summary");

  return (
    <div className="card p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          Creative Brief
        </h2>
        {objective && (
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            {objective}
          </p>
        )}
        {!objective && (
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
            {request.task_type.replace(/_/g, " ")} &mdash;{" "}
            {request.target_languages.join(", ") || "All languages"}
            {request.target_regions.length > 0 && ` in ${request.target_regions.join(", ")}`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Personas */}
        {personas.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              <Users size={14} />
              Personas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {personas.map((p, i) => (
                <span key={i} className="tag-pill">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tone + Style */}
        {(tone || style) && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              <Palette size={14} />
              Tone &amp; Style
            </div>
            <p className="text-sm text-[var(--foreground)]">
              {[tone, style].filter(Boolean).join(" / ")}
            </p>
          </div>
        )}

        {/* Do NOT list */}
        {doNotList.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 uppercase tracking-wide">
              <AlertTriangle size={14} />
              Do NOT
            </div>
            <ul className="text-sm text-[var(--foreground)] space-y-0.5">
              {doNotList.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-red-400 mt-0.5 shrink-0">&times;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cultural Notes */}
        {culturalNotes && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              <Globe size={14} />
              Cultural Notes
            </div>
            <p className="text-sm text-[var(--foreground)]">{culturalNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
