"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { Theme } from "../gallery/tokens";
import { FONT, FIGMA_ICON } from "../gallery/tokens";

interface FigmaExportButtonProps {
  requestId: string;
  theme: Theme;
  campaignSlug: string;
}

export default function FigmaExportButton({
  requestId,
  theme,
  campaignSlug,
}: FigmaExportButtonProps) {
  const [figmaFileUrl, setFigmaFileUrl] = useState<string | null>(null);

  // Check if Figma is connected to get the file URL
  useEffect(() => {
    fetch(`/api/figma/status/${requestId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.connected && data?.file_url) {
          setFigmaFileUrl(data.file_url);
        }
      })
      .catch(() => {});
  }, [requestId]);

  function handleExport() {
    // Download the ZIP package
    window.open(`/api/export/figma-package/${requestId}`, "_blank");

    // If Figma is connected, also open the Figma file
    if (figmaFileUrl) {
      setTimeout(() => {
        window.open(figmaFileUrl, "_blank");
      }, 500); // slight delay so browser doesn't block the second popup
      toast.success("Package downloading — Figma file opening. Drag the files into your project.");
    } else {
      toast.success("Package downloading — drag the files into your Figma project.");
    }
  }

  return (
    <button
      onClick={handleExport}
      title={`Export ${campaignSlug || "campaign"} creatives as Figma package`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: 36,
        padding: "0 16px",
        borderRadius: 9999,
        border: `1px solid ${theme.border}`,
        background: theme.border,
        color: theme.text,
        fontFamily: FONT.sans,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{ display: "inline-flex", flexShrink: 0 }}
        dangerouslySetInnerHTML={{ __html: FIGMA_ICON }}
      />
      Export to Figma
    </button>
  );
}
