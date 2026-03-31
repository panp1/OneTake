"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
} from "lucide-react";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import PipelineProgress from "@/components/PipelineProgress";
import type {
  IntakeRequest,
  GeneratedAsset,
  ComputeJob,
  PipelineRun,
} from "@/lib/types";

interface RecruiterDetailViewProps {
  request: IntakeRequest;
  assets: GeneratedAsset[];
  pipelineRuns: PipelineRun[];
}

export default function RecruiterDetailView({
  request,
  assets,
  pipelineRuns,
}: RecruiterDetailViewProps) {
  const [computeJob, setComputeJob] = useState<ComputeJob | null>(null);
  const [localPipelineRuns, setLocalPipelineRuns] =
    useState<PipelineRun[]>(pipelineRuns);

  // Only show assets that passed evaluation
  const approvedAssets = assets.filter((a) => a.evaluation_passed === true);

  // Poll compute job while generating
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/compute/status/${request.id}`);
      if (res.ok) {
        const { latest } = await res.json();
        setComputeJob(latest ?? null);
      }
    } catch {
      // silently ignore
    }
  }, [request.id]);

  useEffect(() => {
    if (request.status !== "generating") return;
    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [request.status, pollStatus]);

  // Keep pipeline runs in sync if parent re-renders
  useEffect(() => {
    setLocalPipelineRuns(pipelineRuns);
  }, [pipelineRuns]);

  function handleDownloadAll() {
    for (const asset of approvedAssets) {
      if (asset.blob_url) window.open(asset.blob_url, "_blank");
    }
  }

  const showProgress =
    request.status === "generating" || localPipelineRuns.length > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Accent stripe */}
      <div className="gradient-accent h-1" />

      {/* Header */}
      <div className="bg-white border-b border-[var(--border)] px-6 md:px-10 py-4">
        <div className="max-w-[900px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">
                {request.title}
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                {request.task_type.replace(/_/g, " ")} &middot; Created{" "}
                {new Date(request.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusBadge status={request.status} />
            <UrgencyBadge urgency={request.urgency} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 md:px-10 py-6 max-w-[900px] mx-auto space-y-6">
        {/* Pipeline progress */}
        {showProgress && (
          <section className="card p-6">
            <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">
              Pipeline Progress
            </h2>

            {/* Compute job status banner */}
            {request.status === "generating" && (
              <div className="mb-4">
                {(!computeJob || computeJob.status === "pending") && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-[var(--radius-sm)] px-4 py-3">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Queued — waiting for worker to pick up…</span>
                  </div>
                )}
                {computeJob?.status === "processing" && (
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-[var(--radius-sm)] px-4 py-3">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Generating creatives…</span>
                  </div>
                )}
                {computeJob?.status === "complete" && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-[var(--radius-sm)] px-4 py-3">
                    <CheckCircle2 size={16} />
                    <span>Generation complete!</span>
                  </div>
                )}
              </div>
            )}

            <PipelineProgress runs={localPipelineRuns} />
          </section>
        )}

        {/* Status message card */}
        <section className="card p-6">
          {request.status === "generating" && (
            <div className="flex items-center gap-3 text-sm text-blue-700">
              <Loader2 size={18} className="animate-spin shrink-0" />
              <div>
                <p className="font-semibold">Generating…</p>
                <p className="text-[var(--muted-foreground)] mt-0.5">
                  The AI pipeline is building your creative package. Check back
                  shortly.
                </p>
              </div>
            </div>
          )}

          {(request.status === "draft" || request.status === "review") && (
            <div className="flex items-center gap-3 text-sm text-[var(--foreground)]">
              <Clock
                size={18}
                className="text-[var(--muted-foreground)] shrink-0"
              />
              <div>
                <p className="font-semibold">Under review by marketing team</p>
                <p className="text-[var(--muted-foreground)] mt-0.5">
                  Your request is being reviewed. You will be notified once
                  creatives are approved.
                </p>
              </div>
            </div>
          )}

          {(request.status === "approved" || request.status === "sent") && (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 text-sm text-green-700">
                <CheckCircle2 size={18} className="shrink-0" />
                <div>
                  <p className="font-semibold">Creatives approved</p>
                  <p className="text-[var(--muted-foreground)] mt-0.5">
                    {approvedAssets.length} approved asset
                    {approvedAssets.length !== 1 ? "s" : ""} ready for
                    download.
                  </p>
                </div>
              </div>
              {approvedAssets.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  className="btn-primary cursor-pointer shrink-0"
                >
                  <Download size={16} />
                  Download Package
                </button>
              )}
            </div>
          )}
        </section>

        {/* Approved assets grid */}
        {approvedAssets.length > 0 &&
          (request.status === "approved" || request.status === "sent") && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--foreground)]">
                  Approved Assets
                </h2>
                <span className="text-sm text-[var(--muted-foreground)]">
                  {approvedAssets.length} asset
                  {approvedAssets.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {approvedAssets.map((asset) => {
                  const actorName = (
                    asset.content as Record<string, unknown>
                  )?.actor_name as string | undefined;
                  const headline = (
                    (asset.copy_data ?? asset.content) as Record<
                      string,
                      unknown
                    >
                  )?.headline as string | undefined;
                  const label =
                    actorName || headline || asset.platform || "Asset";

                  return (
                    <div key={asset.id} className="card p-3 space-y-2">
                      {/* Preview */}
                      <div className="aspect-square rounded-[10px] bg-[var(--muted)] overflow-hidden flex items-center justify-center">
                        {asset.blob_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={asset.blob_url}
                            alt={label}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-[var(--muted-foreground)]">
                            No preview
                          </span>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="text-xs space-y-0.5">
                        <p className="font-medium text-[var(--foreground)] truncate">
                          {label}
                        </p>
                        <p className="text-[var(--muted-foreground)]">
                          {asset.platform} &middot; {asset.format}
                        </p>
                      </div>

                      {/* Download */}
                      {asset.blob_url && (
                        <button
                          onClick={() =>
                            window.open(asset.blob_url!, "_blank")
                          }
                          className="btn-secondary text-xs px-3 py-1.5 w-full cursor-pointer"
                        >
                          <Download size={12} />
                          Download
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        {/* Request details card */}
        <section className="card p-6">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">
            Request Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {request.target_languages?.length > 0 && (
              <div>
                <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                  Languages
                </span>
                <span className="text-[var(--foreground)]">
                  {request.target_languages.join(", ")}
                </span>
              </div>
            )}
            {request.target_regions?.length > 0 && (
              <div>
                <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                  Regions
                </span>
                <span className="text-[var(--foreground)]">
                  {request.target_regions.join(", ")}
                </span>
              </div>
            )}
            {request.volume_needed != null && (
              <div>
                <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                  Volume Needed
                </span>
                <span className="text-[var(--foreground)]">
                  {request.volume_needed.toLocaleString()}
                </span>
              </div>
            )}
            <div>
              <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                Created
              </span>
              <span className="text-[var(--foreground)]">
                {new Date(request.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                Task Type
              </span>
              <span className="text-[var(--foreground)] capitalize">
                {request.task_type.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
