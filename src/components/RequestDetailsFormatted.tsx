"use client";

import {
  Globe,
  Target,
  DollarSign,
  Clock,
  FileText,
  Mic,
  Users,
  Laptop,
  MapPin,
  Tag,
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

function DetailCard({
  icon: Icon,
  label,
  children,
  accentColor = "#6B21A8",
}: {
  icon: React.ComponentType<Record<string, unknown>>;
  label: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: `${accentColor}10`, color: accentColor }}
      >
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] block mb-0.5">
          {label}
        </span>
        <div className="text-[13px] text-[var(--foreground)] leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

function TagList({ items, color = "#6B21A8" }: { items: string[]; color?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {items.map((item, i) => (
        <span
          key={i}
          className="px-2 py-0.5 rounded-md text-[11px] font-medium"
          style={{
            backgroundColor: `${color}08`,
            color,
            border: `1px solid ${color}20`,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.join(", ");
  return "";
}

export default function RequestDetailsFormatted({
  formData,
  request,
  editable = true,
  onFieldSave,
}: RequestDetailsFormattedProps) {
  const compensation = (formData.compensation || {}) as Record<string, string>;
  const requirements = (formData.requirements || {}) as Record<string, string | boolean | string[]>;
  const taskDetails = (formData.task_details || {}) as Record<string, string | boolean>;
  const languagePairs = formData.language_pairs as string[] | undefined;

  return (
    <div className="space-y-6">
      {/* Hero row */}
      <div className="grid grid-cols-2 gap-6">
        <DetailCard icon={FileText} label="Campaign Goal" accentColor="#0693E3">
          <EditableField
            value={String(formData.goal || formData.description || "")}
            editable={editable}
            onSave={(v) => onFieldSave?.("goal", v)}
            textClassName="text-[13px] leading-relaxed"
            multiline
          />
        </DetailCard>

        <DetailCard icon={Briefcase} label="Task Type" accentColor="#6B21A8">
          <span className="font-medium">
            {String(request.task_type || "").replace(/_/g, " ")}
          </span>
        </DetailCard>
      </div>

      {/* Languages & Regions */}
      <div className="grid grid-cols-2 gap-6">
        <DetailCard icon={Globe} label="Target Regions" accentColor="#0693E3">
          <TagList
            items={request.target_regions || []}
            color="#0693E3"
          />
        </DetailCard>

        <DetailCard icon={Volume2} label="Language Pairs" accentColor="#9B51E0">
          {languagePairs ? (
            <TagList items={languagePairs} color="#9B51E0" />
          ) : (
            <TagList
              items={request.target_languages || []}
              color="#9B51E0"
            />
          )}
        </DetailCard>
      </div>

      {/* Compensation & Volume */}
      <div className="grid grid-cols-3 gap-6">
        <DetailCard icon={DollarSign} label="Compensation" accentColor="#22c55e">
          <div>
            <span className="font-medium">
              {compensation.type ? String(compensation.type).replace(/_/g, " ") : "Not specified"}
            </span>
            {compensation.description ? (
              <span className="text-[var(--muted-foreground)] block text-[12px] mt-0.5">
                {String(compensation.description)}
              </span>
            ) : null}
          </div>
        </DetailCard>

        <DetailCard icon={Target} label="Target Volume" accentColor="#E91E8C">
          <span className="text-xl font-bold text-[var(--foreground)]">
            {String(formData.target_volume || "—") || "—"}
          </span>
          <span className="text-[var(--muted-foreground)] text-[12px] ml-1">contributors</span>
        </DetailCard>

        <DetailCard icon={Clock} label="Urgency" accentColor="#f59e0b">
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              formData.urgency === "urgent"
                ? "bg-red-50 text-red-600 border border-red-200"
                : "bg-gray-50 text-gray-600 border border-gray-200"
            }`}
          >
            {String(formData.urgency || "standard") || "standard"}
          </span>
        </DetailCard>
      </div>

      {/* Requirements */}
      {requirements && (
        <DetailCard icon={Shield} label="Requirements" accentColor="#6B21A8">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-1">
            {requirements.bilingual && (
              <div className="flex items-center gap-2 text-[12px]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#6B21A8]" />
                <span>Bilingual required ({String(requirements.l2_level || "")})</span>
              </div>
            )}
            {requirements.native_speaker && (
              <div className="flex items-center gap-2 text-[12px]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#6B21A8]" />
                <span>Native speaker required</span>
              </div>
            )}
            {requirements.min_age && (
              <div className="flex items-center gap-2 text-[12px]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#6B21A8]" />
                <span>Age {String(requirements.min_age || "")}+</span>
              </div>
            )}
            {requirements.time_commitment && (
              <div className="flex items-center gap-2 text-[12px]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0693E3]" />
                <span>{String(requirements.time_commitment || "")}</span>
              </div>
            )}
            {Array.isArray(requirements.equipment) && (
              <div className="col-span-2">
                <TagList
                  items={requirements.equipment as string[]}
                  color="#737373"
                />
              </div>
            )}
            {requirements.environment && (
              <div className="flex items-center gap-2 text-[12px] col-span-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span>{String(requirements.environment || "")}</span>
              </div>
            )}
          </div>
        </DetailCard>
      )}

      {/* Task Details */}
      {taskDetails && (
        <DetailCard icon={Mic} label="Task Details" accentColor="#E91E8C">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-1">
            {taskDetails.dialogue_type && (
              <div className="text-[12px]">
                <span className="text-[var(--muted-foreground)]">Type: </span>
                <span className="font-medium">{String(taskDetails.dialogue_type || "")}</span>
              </div>
            )}
            {taskDetails.num_dialogue_sets && (
              <div className="text-[12px]">
                <span className="text-[var(--muted-foreground)]">Sets: </span>
                <span className="font-medium">{String(taskDetails.num_dialogue_sets || "")}</span>
              </div>
            )}
            {taskDetails.code_switching !== undefined && (
              <div className="text-[12px]">
                <span className="text-[var(--muted-foreground)]">Code-switching: </span>
                <span className="font-medium">{taskDetails.code_switching ? "Yes" : "No"}</span>
              </div>
            )}
            {taskDetails.recording_quality && (
              <div className="text-[12px]">
                <span className="text-[var(--muted-foreground)]">Quality: </span>
                <span className="font-medium">{String(taskDetails.recording_quality || "")}</span>
              </div>
            )}
          </div>
        </DetailCard>
      )}

      {/* Source URL */}
      {formData.source_url && (
        <DetailCard icon={ExternalLink} label="Source" accentColor="#737373">
          <a
            href={String(formData.source_url || "")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0693E3] hover:underline text-[12px] flex items-center gap-1"
          >
            {String(formData.source_url || "")}
            <ExternalLink size={11} />
          </a>
        </DetailCard>
      )}
    </div>
  );
}
