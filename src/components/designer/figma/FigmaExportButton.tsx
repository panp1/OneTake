"use client";

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
  function handleExport() {
    window.open(`/api/export/figma-package/${requestId}`, "_blank");
    toast.success("Downloading Figma package...");
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
