"use client";

import { use, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
} from "lucide-react";
import DesignerGallery from "@/components/designer/gallery/DesignerGallery";
import type { IntakeRequest, GeneratedAsset, CreativeBrief, ActorProfile } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────

interface DesignerNote {
  id: string;
  request_id: string;
  asset_id: string;
  note_text: string;
  created_at: string;
}

interface DesignerUpload {
  id: string;
  request_id: string;
  original_asset_id: string | null;
  file_name: string;
  blob_url: string;
  uploaded_by: string;
  created_at: string;
}

interface DesignerData {
  request: IntakeRequest;
  assets: GeneratedAsset[];
  brief: CreativeBrief | null;
  actors: ActorProfile[];
  uploads: DesignerUpload[];
  notes: DesignerNote[];
}

// ── Main content component ────────────────────────────────────

function DesignerContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [data, setData] = useState<DesignerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!token) {
        setError("Missing access token. Please use a valid designer link.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/designer/${id}?token=${token}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Invalid or expired link");
        }
        const result: DesignerData = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, token]);

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 size={32} className="text-[var(--muted-foreground)] animate-spin mb-3" />
        <p className="text-sm text-[var(--muted-foreground)]">Loading assets...</p>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <AlertCircle size={32} className="text-[var(--muted-foreground)] mb-3" />
        <p className="text-sm text-[var(--foreground)] font-medium mb-1">Access Denied</p>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm text-center">
          {error || "Unable to load designer view"}
        </p>
      </div>
    );
  }

  return (
    <DesignerGallery
      request={data.request}
      brief={data.brief}
      assets={data.assets}
      actors={data.actors}
      token={token}
    />
  );
}

// ── Fallback ──────────────────────────────────────────────────

function DesignerFallback() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <Loader2 size={32} className="text-[var(--muted-foreground)] animate-spin mb-3" />
      <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────

export default function DesignerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense fallback={<DesignerFallback />}>
      <DesignerContent id={id} />
    </Suspense>
  );
}
