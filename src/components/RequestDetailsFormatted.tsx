"use client";

import {
  Globe,
  Target,
  DollarSign,
  Clock,
  FileText,
  Mic,
  Users,
  ExternalLink,
  Volume2,
  Shield,
  Briefcase,
} from "lucide-react";
import EditableField from "@/components/EditableField";

interface RequestDetailsFormattedProps {
  formData: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  request: {
    title?: string;
    task_type?: string;
    status?: string;
    target_languages?: string[];
    target_regions?: string[];
    created_at?: string;
  };
  editable?: boolean;
  onFieldSave?: (field: string, value: string) => void;
}

function Tag({ children, color = "#6B21A8" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium leading-none"
      style={{
        backgroundColor: `${color}0A`,
        color,
        border: `1px solid ${color}18`,
      }}
    >
      {children}
    </span>
  );
}

function SectionDivider() {
  return <div className="border-t border-[var(--border)] my-5" />;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)] block mb-1.5">
      {children}
    </span>
  );
}

export default function RequestDetailsFormatted({
  formData,
  request,
  editable = true,
  onFieldSave,
}: RequestDetailsFormattedProps) {
  // Normalize field names — form_data keys vary by task type schema
  const compensation = formData.compensation || {};
  const compensationModel = formData.compensation_model || compensation.type || "";
  const compensationDesc = formData.compensation_description || compensation.description || "";
  const requirements = formData.requirements || {};
  const taskDetails = formData.task_details || {};
  const taskDescription = formData.task_description || formData.description || formData.goal || "";
  const targetVolume = formData.volume_needed || formData.target_volume || "";
  const languagePairs = formData.language_pairs as string[] | undefined;
  const ndaRequired = formData.nda_required || formData.nda || false;
  const commitmentLevel = formData.commitment_level || formData.commitment || "";

  return (
    <div className="space-y-0">

      {/* ── ROW 1: What is this campaign? ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:gap-12 items-start">
        <div>
          <Label>Campaign Goal</Label>
          <EditableField
            value={String(taskDescription)}
            editable={editable}
            onSave={(v) => onFieldSave?.("task_description", v)}
            textClassName="text-[14px] leading-relaxed text-[var(--foreground)]"
            multiline
          />
        </div>
        <div className="sm:text-right sm:min-w-[200px]">
          <Label>Task Type</Label>
          <div className="flex items-center gap-2 justify-end">
            <Briefcase size={14} className="text-[#6B21A8]" />
            <span className="text-[14px] font-medium text-[var(--foreground)]">
              {String(request.task_type || "").replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* ── ROW 2: Where are we targeting? ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-12">
        <div>
          <Label>Target Regions</Label>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {(request.target_regions || []).map((r, i) => (
              <Tag key={i} color="#0693E3">{r}</Tag>
            ))}
          </div>
        </div>
        <div>
          <Label>Language Pairs</Label>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {(languagePairs || request.target_languages || []).map((l, i) => (
              <Tag key={i} color="#9B51E0">{l}</Tag>
            ))}
          </div>
        </div>
      </div>

      <SectionDivider />

      {/* ── ROW 3: Compensation, Volume, Urgency ──────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
        <div>
          <Label>Compensation</Label>
          <p className="text-[14px] font-semibold text-[var(--foreground)]">
            {compensationModel
              ? String(compensationModel).replace(/_/g, " ")
              : "Not specified"}
          </p>
          {compensationDesc && (
            <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">
              {String(compensationDesc)}
            </p>
          )}
        </div>
        <div>
          <Label>Target Volume</Label>
          <p className="text-[14px] text-[var(--foreground)]">
            <span className="text-2xl font-bold tracking-tight">
              {String(targetVolume || "—")}
            </span>
            <span className="text-[var(--muted-foreground)] text-[13px] ml-1.5">
              contributors
            </span>
          </p>
        </div>
        <div>
          <Label>Urgency</Label>
          <span
            className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold leading-none mt-0.5 ${
              formData.urgency === "urgent"
                ? "bg-red-50 text-red-600 border border-red-100"
                : "bg-gray-50 text-gray-500 border border-gray-200"
            }`}
          >
            {String(formData.urgency || "standard")}
          </span>
        </div>
      </div>

      {/* ── ROW 4: Requirements (if present) ───────────────── */}
      {requirements && Object.keys(requirements).length > 0 && (
        <>
          <SectionDivider />
          <div>
            <Label>Requirements</Label>
            <div className="grid grid-cols-2 gap-x-12 gap-y-1.5 mt-1">
              {requirements.bilingual && (
                <div className="flex items-center gap-2 text-[13px] text-[var(--foreground)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6B21A8] flex-shrink-0" />
                  Bilingual required ({String(requirements.l2_level || "proficient")})
                </div>
              )}
              {requirements.native_speaker && (
                <div className="flex items-center gap-2 text-[13px] text-[var(--foreground)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6B21A8] flex-shrink-0" />
                  Native speaker required
                </div>
              )}
              {requirements.min_age && (
                <div className="flex items-center gap-2 text-[13px] text-[var(--foreground)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6B21A8] flex-shrink-0" />
                  Age {String(requirements.min_age)}+
                </div>
              )}
              {requirements.time_commitment && (
                <div className="flex items-center gap-2 text-[13px] text-[var(--foreground)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0693E3] flex-shrink-0" />
                  {String(requirements.time_commitment)}
                </div>
              )}
            </div>
            {Array.isArray(requirements.equipment) && requirements.equipment.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(requirements.equipment as string[]).map((eq, i) => (
                  <Tag key={i} color="#737373">{eq}</Tag>
                ))}
              </div>
            )}
            {requirements.environment && (
              <div className="flex items-center gap-2 text-[13px] text-[var(--foreground)] mt-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] flex-shrink-0" />
                {String(requirements.environment)}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ROW 5: Task Details (if present) ────────────────── */}
      {taskDetails && Object.keys(taskDetails).length > 0 && (
        <>
          <SectionDivider />
          <div>
            <Label>Task Details</Label>
            <div className="grid grid-cols-2 gap-x-12 gap-y-1.5 mt-1">
              {taskDetails.dialogue_type && (
                <div className="text-[13px]">
                  <span className="text-[var(--muted-foreground)]">Type: </span>
                  <span className="font-medium text-[var(--foreground)]">{String(taskDetails.dialogue_type)}</span>
                </div>
              )}
              {taskDetails.num_dialogue_sets && (
                <div className="text-[13px]">
                  <span className="text-[var(--muted-foreground)]">Sets: </span>
                  <span className="font-medium text-[var(--foreground)]">{String(taskDetails.num_dialogue_sets)}</span>
                </div>
              )}
              {taskDetails.code_switching !== undefined && (
                <div className="text-[13px]">
                  <span className="text-[var(--muted-foreground)]">Code-switching: </span>
                  <span className="font-medium text-[var(--foreground)]">{taskDetails.code_switching ? "Yes" : "No"}</span>
                </div>
              )}
              {taskDetails.recording_quality && (
                <div className="text-[13px]">
                  <span className="text-[var(--muted-foreground)]">Quality: </span>
                  <span className="font-medium text-[var(--foreground)]">{String(taskDetails.recording_quality)}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── ROW 6: Source URL (if present) ──────────────────── */}
      {formData.source_url && (
        <>
          <SectionDivider />
          <div>
            <Label>Source</Label>
            <a
              href={String(formData.source_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0693E3] hover:underline text-[13px] inline-flex items-center gap-1.5"
            >
              {String(formData.source_url)}
              <ExternalLink size={12} />
            </a>
          </div>
        </>
      )}
      {/* ── Additional Fields (NDA, commitment, etc) ──────── */}
      {(ndaRequired || commitmentLevel) && (
        <>
          <SectionDivider />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {ndaRequired && (
              <div>
                <Label>NDA Required</Label>
                <div className="flex items-center gap-1.5">
                  <Shield size={14} className="text-red-500" />
                  <span className="text-[14px] font-semibold text-red-600">Yes</span>
                </div>
              </div>
            )}
            {commitmentLevel && (
              <div>
                <Label>Commitment Level</Label>
                <span className="text-[14px] font-medium text-[var(--foreground)] capitalize">{String(commitmentLevel).replace(/_/g, " ")}</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Catch-all: Show any form_data fields not already rendered ── */}
      {(() => {
        const rendered = new Set(["title", "urgency", "goal", "description", "task_description", "compensation", "compensation_model", "compensation_description", "target_volume", "volume_needed", "requirements", "task_details", "source_url", "language_pairs", "target_regions", "target_languages", "nda_required", "nda", "commitment_level", "commitment"]);
        const remaining = Object.entries(formData).filter(([k, v]) => !rendered.has(k) && v !== null && v !== undefined && v !== "");
        if (remaining.length === 0) return null;
        return (
          <>
            <SectionDivider />
            <div>
              <Label>Additional Details</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                {remaining.map(([k, v]) => (
                  <div key={k}>
                    <span className="text-[12px] font-semibold text-[var(--muted-foreground)] capitalize block mb-0.5">{k.replace(/_/g, " ")}</span>
                    <span className="text-[13px] text-[var(--foreground)]">
                      {Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
