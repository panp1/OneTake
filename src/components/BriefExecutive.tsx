"use client";

import {
  Target,
  MessageSquare,
  Users,
  Globe,
  Shield,
  Palette,
  Megaphone,
  Heart,
  AlertTriangle,
  Sparkles,
  Languages,
} from "lucide-react";
import EditableField from "@/components/EditableField";
import MiniTabs from "@/components/MiniTabs";
import { toReadable } from "@/lib/format";

interface BriefExecutiveProps {
  briefData: Record<string, any>;
  channelResearch?: Record<string, any> | null;
  designDirection?: Record<string, any> | null;
  editable?: boolean;
  onFieldSave?: (path: string, value: string) => void;
}

function SectionHeader({
  icon: Icon,
  title,
  color = "#6B21A8",
}: {
  icon: React.ComponentType<Record<string, any>>;
  title: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center"
        style={{ backgroundColor: `${color}10`, color }}
      >
        <Icon size={13} />
      </div>
      <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--foreground)]">
        {title}
      </h3>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[var(--border)] my-6" />;
}

function Tag({ children, color = "#6B21A8" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium leading-none"
      style={{ backgroundColor: `${color}08`, color, border: `1px solid ${color}15` }}
    >
      {children}
    </span>
  );
}

function BulletList({ items, color = "#6B21A8" }: { items: string[]; color?: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--foreground)] leading-relaxed">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[7px]" style={{ backgroundColor: color }} />
          {item}
        </li>
      ))}
    </ul>
  );
}

function PersonaHookCard({
  personaKey,
  hook,
  motivations,
  painPoints,
  psychologyHook,
}: {
  personaKey: string;
  hook?: string;
  motivations?: string[];
  painPoints?: string[];
  psychologyHook?: string;
}) {
  const colors: Record<string, string> = {
    0: "#6B21A8",
    1: "#0693E3",
    2: "#E91E8C",
    3: "#22c55e",
  };
  const color = colors[String(Object.keys(colors).length % 4)] || "#6B21A8";

  return (
    <div className="border border-[var(--border)] rounded-xl p-4 space-y-2" style={{ borderTopColor: color, borderTopWidth: "2px" }}>
      <h4 className="text-[12px] font-bold text-[var(--foreground)] capitalize">
        {personaKey.replace(/_/g, " ")}
      </h4>
      {hook && (
        <p className="text-[13px] text-[var(--foreground)] font-medium leading-relaxed">
          &ldquo;{hook}&rdquo;
        </p>
      )}
      {motivations && motivations.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Motivations</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {motivations.map((m, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-[var(--muted)] rounded-md text-[var(--foreground)]">{m}</span>
            ))}
          </div>
        </div>
      )}
      {painPoints && painPoints.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Pain Points</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {painPoints.map((p, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-red-50 text-red-700 rounded-md">{p}</span>
            ))}
          </div>
        </div>
      )}
      {psychologyHook && (
        <p className="text-[11px] text-[var(--muted-foreground)] italic">Psychology: {psychologyHook}</p>
      )}
    </div>
  );
}

function PersonaTable({ personas, targetAudience }: { personas: any[]; targetAudience: Record<string, any> }) {
  if (!personas || personas.length === 0) return null;

  const motivations = targetAudience.motivations_by_persona || {};
  const painPoints = targetAudience.pain_points_by_persona || {};
  const psychology = targetAudience.psychology_hooks_by_persona || {};

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b-2 border-[var(--border)]">
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Persona</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Age</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Region</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Motivations</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Pain Points</th>
            <th className="text-left py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Psychology Hook</th>
          </tr>
        </thead>
        <tbody>
          {personas.map((p: any, i: number) => {
            const key = p.archetype_key || `persona_${i + 1}`;
            const colors = ["#6B21A8", "#0693E3", "#E91E8C", "#22c55e"];
            const color = colors[i % colors.length];
            const tp = p.targeting_profile?.demographics || {};

            return (
              <tr key={key} className="border-b border-[var(--border)] last:border-0">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div>
                      <span className="font-semibold text-[var(--foreground)] block">{p.persona_name || p.name || key.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">{p.archetype || tp.occupation || ""}</span>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 text-[var(--foreground)] whitespace-nowrap">
                  {p.age_range || (tp.age_min && tp.age_max ? `${tp.age_min}-${tp.age_max}` : p.age || "—")}
                </td>
                <td className="py-3 pr-4 text-[var(--foreground)]">
                  {p.region || "—"}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {((motivations[key] || p.motivations || []) as string[]).slice(0, 2).map((m: string, j: number) => (
                      <span key={j} className="px-1.5 py-0.5 bg-[#22c55e08] text-[#22c55e] rounded text-[10px] border border-[#22c55e15]">{m}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {((painPoints[key] || p.pain_points || []) as string[]).slice(0, 2).map((pp: string, j: number) => (
                      <span key={j} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] border border-red-100">{pp}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3">
                  <span className="text-[11px] text-[var(--muted-foreground)] italic">
                    {(psychology[key] || p.psychology_profile?.primary_bias || "—") as string}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChannelMatrix({ channels, personas }: { channels: Record<string, any>; personas: any[] }) {
  const perPersona = channels.per_persona || {};
  const allChannels = new Set<string>();

  // Collect all unique channels
  (channels.primary || []).forEach((c: string) => allChannels.add(c));
  (channels.secondary || []).forEach((c: string) => allChannels.add(c));
  Object.values(perPersona).forEach((chs: any) => {
    if (Array.isArray(chs)) chs.forEach((c: string) => allChannels.add(c));
  });

  if (allChannels.size === 0) return null;

  const channelList = Array.from(allChannels);
  const primarySet = new Set(channels.primary || []);
  const secondarySet = new Set(channels.secondary || []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b-2 border-[var(--border)]">
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Channel</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Priority</th>
            {personas.map((p: any, i: number) => (
              <th key={i} className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                {p.persona_name || p.name || `P${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {channelList.map((ch) => {
            const isPrimary = primarySet.has(ch);
            const isSecondary = secondarySet.has(ch);

            return (
              <tr key={ch} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2.5 pr-4 font-medium text-[var(--foreground)]">{ch}</td>
                <td className="py-2.5 pr-4">
                  {isPrimary ? (
                    <span className="px-2 py-0.5 bg-[#0693E308] text-[#0693E3] rounded-md text-[10px] font-semibold border border-[#0693E315]">Primary</span>
                  ) : isSecondary ? (
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md text-[10px] font-semibold border border-gray-200">Secondary</span>
                  ) : (
                    <span className="text-[var(--muted-foreground)] text-[10px]">—</span>
                  )}
                </td>
                {personas.map((p: any, i: number) => {
                  const key = p.archetype_key || `persona_${i + 1}`;
                  const personaChannels = perPersona[key] || [];
                  const isActive = Array.isArray(personaChannels) && personaChannels.includes(ch);

                  return (
                    <td key={i} className="py-2.5 px-2 text-center">
                      {isActive ? (
                        <div className="w-5 h-5 rounded-full bg-[#0693E310] flex items-center justify-center mx-auto">
                          <div className="w-2 h-2 rounded-full bg-[#0693E3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[var(--muted)] flex items-center justify-center mx-auto">
                          <div className="w-1 h-1 rounded-full bg-[var(--border)]" />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const PLATFORM_TARGETING: Record<string, { label: string; hyper: string; hot: string; broad: string }> = {
  Instagram: { label: "Meta (IG)", hyper: "Interest targeting", hot: "Stacked interests", broad: "Broad demographics" },
  Facebook: { label: "Meta (FB)", hyper: "Interest targeting", hot: "Stacked interests", broad: "Broad demographics" },
  TikTok: { label: "TikTok", hyper: "Interest targeting", hot: "Behavior + interest", broad: "Broad age/geo" },
  LinkedIn: { label: "LinkedIn", hyper: "Job title + skill", hot: "Industry + seniority", broad: "Company size" },
  Telegram: { label: "Telegram", hyper: "Channel targeting", hot: "Group interests", broad: "Broad geo" },
  YouTube: { label: "YouTube", hyper: "In-market + affinity", hot: "Custom intent", broad: "Demographics" },
  Twitter: { label: "X (Twitter)", hyper: "Keyword + follower LLA", hot: "Conversation topics", broad: "Interest categories" },
  X: { label: "X (Twitter)", hyper: "Keyword + follower LLA", hot: "Conversation topics", broad: "Interest categories" },
  Snapchat: { label: "Snapchat", hyper: "Lifestyle Categories", hot: "Stacked interests", broad: "Demographics + geo" },
  WhatsApp: { label: "WhatsApp", hyper: "Via Meta Ads", hot: "Via Meta Ads", broad: "Via Meta Ads" },
  WeChat: { label: "WeChat", hyper: "Interest + behavior", hot: "Stacked tags", broad: "Demographics" },
  Pinterest: { label: "Pinterest", hyper: "Interest + keyword", hot: "Actalike targeting", broad: "Broad interests" },
};

function TargetingTable({ personas, channels }: { personas: any[]; channels: Record<string, any> }) {
  const allChannels = [...new Set([...(channels.primary || []), ...(channels.secondary || [])])];
  if (allChannels.length === 0 || personas.length === 0) return null;

  return (
    <div className="space-y-4">
      {personas.map((p: any, pi: number) => {
        const tp = p.targeting_profile || {};
        const interests = tp.interests || {};
        const demo = tp.demographics || {};
        const colors = ["#6B21A8", "#0693E3", "#E91E8C", "#22c55e"];
        const color = colors[pi % colors.length];
        const personaChannels = (channels.per_persona?.[p.archetype_key] || allChannels) as string[];

        return (
          <div key={pi} className="border border-[var(--border)] rounded-xl overflow-hidden">
            {/* Persona header */}
            <div className="px-4 py-2.5 bg-[var(--muted)] flex items-center justify-between" style={{ borderLeft: `3px solid ${color}` }}>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--foreground)]">
                  {p.persona_name || p.name || p.archetype_key?.replace(/_/g, " ")}
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {demo.age_min && demo.age_max ? `${demo.age_min}-${demo.age_max}` : p.age_range || ""}
                  {demo.occupation ? ` · ${demo.occupation}` : ""}
                </span>
              </div>
              <div className="flex gap-1">
                {(interests.hyper || []).slice(0, 3).map((h: string, i: number) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: `${color}08`, color, border: `1px solid ${color}15` }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>

            {/* Platform routing table */}
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-1.5 px-4 text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Platform</th>
                  <th className="text-left py-1.5 px-3 text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Hyper Targeting</th>
                  <th className="text-left py-1.5 px-3 text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Hot Targeting</th>
                  <th className="text-left py-1.5 px-3 text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Broad Targeting</th>
                  <th className="text-left py-1.5 px-3 text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Interests Applied</th>
                </tr>
              </thead>
              <tbody>
                {personaChannels.map((ch: string) => {
                  const platform = PLATFORM_TARGETING[ch] || { label: ch, hyper: "Interest targeting", hot: "Stacked interests", broad: "Broad" };
                  return (
                    <tr key={ch} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 px-4 font-medium text-[var(--foreground)]">{platform.label}</td>
                      <td className="py-2 px-3 text-[var(--muted-foreground)]">{platform.hyper}</td>
                      <td className="py-2 px-3 text-[var(--muted-foreground)]">{platform.hot}</td>
                      <td className="py-2 px-3 text-[var(--muted-foreground)]">{platform.broad}</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-0.5">
                          {(interests.hyper || []).slice(0, 2).map((h: string, i: number) => (
                            <span key={`h${i}`} className="px-1 py-0.5 bg-[#6B21A808] text-[#6B21A8] rounded text-[9px] border border-[#6B21A815]">{h}</span>
                          ))}
                          {(interests.hot || []).slice(0, 1).map((h: string, i: number) => (
                            <span key={`o${i}`} className="px-1 py-0.5 bg-[#f59e0b08] text-[#f59e0b] rounded text-[9px] border border-[#f59e0b15]">{h}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export default function BriefExecutive({
  briefData,
  channelResearch,
  designDirection,
  editable = false,
  onFieldSave,
}: BriefExecutiveProps) {
  const messaging = briefData.messaging_strategy || {};
  const targetAudience = briefData.target_audience || {};
  const contentLang = briefData.content_language || {};
  const channels = briefData.channels || {};
  const guardrails = briefData.cultural_guardrails || {};
  const personas = briefData.personas || [];

  const perPersonaHooks = messaging.per_persona_hooks || {};
  const motivationsByPersona = targetAudience.motivations_by_persona || {};
  const painPointsByPersona = targetAudience.pain_points_by_persona || {};
  const psychologyByPersona = targetAudience.psychology_hooks_by_persona || {};

  // Build tab content
  const hasPersonas = personas.length > 0 || Object.keys(perPersonaHooks).length > 0;
  const hasChannels = channels.primary?.length > 0 || channels.secondary?.length > 0;
  const hasCulture = guardrails.things_to_avoid?.length > 0 || guardrails.things_to_lean_into?.length > 0 || contentLang.primary;

  return (
    <div>
      {/* Campaign Objective — always visible above tabs */}
      <div className="mb-4">
        <EditableField
          value={briefData.campaign_objective || briefData.summary || ""}
          editable={editable}
          onSave={(v) => onFieldSave?.("campaign_objective", v)}
          textClassName="text-[15px] leading-relaxed text-[var(--foreground)]"
          multiline
        />
      </div>

      {/* Mini Tabs */}
      <MiniTabs
        defaultTab="messaging"
        tabs={[
          // Tab 1: Messaging
          {
            key: "messaging",
            label: "Messaging",
            content: (
              <div className="space-y-4">
                {(messaging.primary_message || messaging.tone) ? (
                  <>
                    <div className="grid grid-cols-[1fr_auto] gap-8">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Primary Message</span>
                        <EditableField
                          value={messaging.primary_message || ""}
                          editable={editable}
                          onSave={(v) => onFieldSave?.("messaging_strategy.primary_message", v)}
                          textClassName="text-[14px] leading-relaxed text-[var(--foreground)] font-medium"
                        />
                      </div>
                      {messaging.tone && (
                        <div className="text-right min-w-[100px]">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Tone</span>
                          <Tag color="#6B21A8">{messaging.tone}</Tag>
                        </div>
                      )}
                    </div>
                    {messaging.value_propositions?.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Value Propositions</span>
                        <BulletList items={messaging.value_propositions} color="#22c55e" />
                      </div>
                    )}
                  </>
                ) : Array.isArray(briefData.messaging_strategy) ? (
                  <BulletList items={briefData.messaging_strategy} color="#6B21A8" />
                ) : null}
                {briefData.value_props && !messaging.value_propositions && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Value Propositions</span>
                    <BulletList items={briefData.value_props} color="#E91E8C" />
                  </div>
                )}
              </div>
            ),
          },

          // Tab 2: Personas
          ...(hasPersonas ? [{
            key: "personas",
            label: "Personas",
            count: personas.length || Object.keys(perPersonaHooks).length,
            content: (
              <div className="space-y-4">
                {personas.length > 0 ? (
                  <PersonaTable personas={personas} targetAudience={targetAudience} />
                ) : Object.keys(perPersonaHooks).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(perPersonaHooks).map(([key, hook]) => (
                      <PersonaHookCard
                        key={key}
                        personaKey={key}
                        hook={String(hook)}
                        motivations={motivationsByPersona[key] as string[]}
                        painPoints={painPointsByPersona[key] as string[]}
                        psychologyHook={psychologyByPersona[key] as string}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          }] : []),

          // Tab 3: Channels
          ...(hasChannels ? [{
            key: "channels",
            label: "Channels",
            count: (channels.primary?.length || 0) + (channels.secondary?.length || 0),
            content: (
              <div className="space-y-5">
                <ChannelMatrix channels={channels} personas={personas} />
                {channels.rationale && (
                  <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed italic">{channels.rationale}</p>
                )}
              </div>
            ),
          }] : []),

          // Tab 4: Targeting
          ...(hasChannels && personas.length > 0 ? [{
            key: "targeting",
            label: "Targeting",
            content: (
              <div>
                <p className="text-[12px] text-[var(--muted-foreground)] mb-3">
                  How each persona&apos;s targeting profile translates to platform-specific ad methods.
                </p>
                <TargetingTable personas={personas} channels={channels} />
              </div>
            ),
          }] : []),

          // Tab 5: Culture & Language
          ...(hasCulture ? [{
            key: "culture",
            label: "Culture & Language",
            content: (
              <div className="space-y-5">
                {(contentLang.primary || contentLang.dialect_notes) && (
                  <div>
                    <SectionHeader icon={Languages} title="Language Configuration" color="#9B51E0" />
                    <div className="grid grid-cols-4 gap-4">
                      {contentLang.primary && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Primary</span>
                          <span className="text-[13px] font-medium text-[var(--foreground)]">{contentLang.primary}</span>
                        </div>
                      )}
                      {contentLang.secondary && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Secondary</span>
                          <span className="text-[13px] text-[var(--foreground)]">{contentLang.secondary}</span>
                        </div>
                      )}
                      {contentLang.formality && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Formality</span>
                          <Tag color="#9B51E0">{contentLang.formality}</Tag>
                        </div>
                      )}
                      {contentLang.dialect_notes && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Dialect</span>
                          <span className="text-[12px] text-[var(--muted-foreground)]">{contentLang.dialect_notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {(guardrails.things_to_avoid?.length > 0 || guardrails.things_to_lean_into?.length > 0) && (
                  <div>
                    <SectionHeader icon={Shield} title="Cultural Guardrails" color="#f59e0b" />
                    <div className="grid grid-cols-2 gap-8">
                      {guardrails.things_to_lean_into?.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#22c55e] block mb-2">Lean Into</span>
                          <BulletList items={guardrails.things_to_lean_into} color="#22c55e" />
                        </div>
                      )}
                      {guardrails.things_to_avoid?.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#ef4444] block mb-2">Avoid</span>
                          <BulletList items={guardrails.things_to_avoid} color="#ef4444" />
                        </div>
                      )}
                    </div>
                    {guardrails.trust_signals?.length > 0 && (
                      <div className="mt-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1.5">Trust Signals</span>
                        <div className="flex flex-wrap gap-1.5">
                          {guardrails.trust_signals.map((s: string, i: number) => (
                            <Tag key={i} color="#22c55e">{s}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ),
          }] : []),
        ]}
      />
    </div>
  );
}
