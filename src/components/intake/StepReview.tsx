"use client";

import { LayoutGrid, FileText, Users, AlertCircle } from "lucide-react";

interface StepReviewProps {
  formData: Record<string, unknown>;
  taskType: string | null;
  workMode: "onsite" | "remote" | null;
  onEditStep: (step: number) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function displayTaskType(type: string | null): string {
  if (!type) return "—";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayWorkMode(mode: "onsite" | "remote" | null): string {
  if (!mode) return "—";
  return mode === "onsite" ? "Onsite Data Collection" : "Remote / Digital Recruitment";
}

function asString(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

function asArrayString(val: unknown): string {
  if (!val) return "—";
  if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "—";
  return String(val);
}

function truncate(val: unknown, max: number): string {
  const s = asString(val);
  if (s === "—") return s;
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  color: "#8A8A8E",
  marginBottom: 2,
};

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#1A1A1A",
  lineHeight: 1.5,
};

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  stepIndex: number;
  onEditStep: (step: number) => void;
}

function SectionHeader({ icon, title, stepIndex, onEditStep }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#6D28D9" }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A" }}>{title}</span>
      </div>
      <button
        onClick={() => onEditStep(stepIndex)}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#6D28D9",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 6px",
          borderRadius: 6,
          fontFamily: "inherit",
        }}
      >
        Edit
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StepReview({
  formData,
  taskType,
  workMode,
  onEditStep,
}: StepReviewProps) {
  const compensationModel = asString(formData.compensation_model);
  const compensationRate = formData.compensation_rate;
  const compensationDisplay =
    compensationModel !== "—" && compensationRate !== undefined && compensationRate !== ""
      ? `${compensationModel} — $${compensationRate}`
      : compensationModel !== "—"
      ? compensationModel
      : "—";

  const monthlyBudget =
    formData.monthly_budget !== undefined && formData.monthly_budget !== ""
      ? `$${formData.monthly_budget}`
      : "—";

  const adaUrl = asString(formData.ada_form_url);
  const adaDisplay =
    workMode === "onsite" ? (
      adaUrl !== "—" ? (
        <span style={{ wordBreak: "break-all" }}>{adaUrl}</span>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#DC2626" }}>
          <AlertCircle size={13} />
          Required — URL not yet provided
        </span>
      )
    ) : null;

  const demographic = asString(formData.demographic);
  const taskDescription = truncate(formData.task_description, 100);
  const requiredQuals = truncate(formData.qualifications_required, 150);
  const preferredQuals = truncate(formData.qualifications_preferred, 150);

  return (
    <div
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "48px 48px",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
          Review &amp; Submit
        </h2>
        <p style={{ fontSize: 13, color: "#8A8A8E", marginTop: 6, marginBottom: 0 }}>
          Double-check everything before submitting. Click &lsquo;Edit&rsquo; on any section to make changes.
        </p>
      </div>

      {/* Review card */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E8E8EA",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        {/* ── Section 1: Task & Mode ───────────────────────────────────── */}
        <div
          style={{
            padding: "28px 32px",
            borderBottom: "1px solid #E8E8EA",
          }}
        >
          <SectionHeader
            icon={<LayoutGrid size={15} />}
            title="Task & Mode"
            stepIndex={1}
            onEditStep={onEditStep}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px 32px",
            }}
          >
            <ReviewRow label="Task Type" value={displayTaskType(taskType)} />
            <ReviewRow label="Work Mode" value={displayWorkMode(workMode)} />
          </div>
        </div>

        {/* ── Section 2: Project Details ───────────────────────────────── */}
        <div
          style={{
            padding: "28px 32px",
            borderBottom: "1px solid #E8E8EA",
          }}
        >
          <SectionHeader
            icon={<FileText size={15} />}
            title="Project Details"
            stepIndex={2}
            onEditStep={onEditStep}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px 32px",
            }}
          >
            <ReviewRow label="Title" value={asString(formData.title)} />
            <ReviewRow
              label="Urgency"
              value={asString(formData.urgency).replace(/\b\w/g, (c) => c.toUpperCase())}
            />
            <ReviewRow label="Contributors Needed" value={asString(formData.volume_needed)} />
            <ReviewRow
              label="Target Regions"
              value={asArrayString(formData.target_regions)}
            />
            <ReviewRow
              label="Target Languages"
              value={asArrayString(formData.target_languages)}
            />
            <ReviewRow label="Compensation" value={compensationDisplay} />
            <ReviewRow label="Monthly Ad Budget" value={monthlyBudget} />
            {demographic !== "—" && (
              <ReviewRow label="Target Demographic" value={demographic} />
            )}
          </div>
          {taskDescription !== "—" && (
            <div style={{ marginTop: 16 }}>
              <ReviewRow label="Task Description" value={taskDescription} />
            </div>
          )}
        </div>

        {/* ── Section 3: Requirements ──────────────────────────────────── */}
        <div style={{ padding: "28px 32px" }}>
          <SectionHeader
            icon={<Users size={15} />}
            title="Requirements"
            stepIndex={3}
            onEditStep={onEditStep}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px 32px",
            }}
          >
            <div style={{ gridColumn: "1 / -1" }}>
              <ReviewRow
                label="Required Qualifications"
                value={requiredQuals}
              />
            </div>
            {preferredQuals !== "—" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <ReviewRow
                  label="Preferred Qualifications"
                  value={preferredQuals}
                />
              </div>
            )}
            <ReviewRow
              label="Engagement Model"
              value={asString(formData.engagement_model)}
            />
            <ReviewRow
              label="Language Requirements"
              value={asString(formData.language_requirements)}
            />
            <div style={{ gridColumn: "1 / -1" }}>
              <ReviewRow
                label="Location & Work Setup"
                value={asString(formData.location_scope)}
              />
            </div>
            {workMode === "onsite" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={labelStyle}>AIDA Screener URL</div>
                <div style={valueStyle}>{adaDisplay}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
