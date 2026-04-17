"use client";

import { Globe, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import type { LocaleLink } from "@/components/intake/LocaleLinksUpload";

interface LocaleLinksTableProps {
  links: LocaleLink[];
  compact?: boolean;
}

function getFlag(locale: string): string {
  // Map locale to country code for flag emoji (e.g., ar_AE → AE, fr_FR → FR)
  const parts = locale.split("_");
  const country = (parts[1] || parts[0]).toUpperCase();
  // Convert country code to flag emoji
  if (country.length !== 2) return "";
  return String.fromCodePoint(
    ...country.split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

export default function LocaleLinksTable({ links, compact = false }: LocaleLinksTableProps) {
  if (!links || links.length === 0) return null;

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Copied link");
  };

  return (
    <div style={{ border: "1px solid #E8E8EA", borderRadius: 10, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        background: "#FAFAFA",
        borderBottom: "1px solid #E8E8EA",
      }}>
        <Globe size={14} style={{ color: "#6B21A8" }} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#8A8A8E" }}>
          Locale Links
        </span>
        <span style={{ fontSize: 11, fontWeight: 500, color: "#B0B0B3" }}>
          {links.length} {links.length === 1 ? "locale" : "locales"}
        </span>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #E8E8EA" }}>
            <th style={{ padding: "7px 14px", textAlign: "left", fontWeight: 700, color: "#8A8A8E", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Locale</th>
            <th style={{ padding: "7px 14px", textAlign: "left", fontWeight: 700, color: "#8A8A8E", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Language</th>
            {!compact && <th style={{ padding: "7px 14px", textAlign: "left", fontWeight: 700, color: "#8A8A8E", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rate</th>}
            <th style={{ padding: "7px 14px", textAlign: "left", fontWeight: 700, color: "#8A8A8E", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Link</th>
            <th style={{ padding: "7px 14px", textAlign: "center", fontWeight: 700, color: "#8A8A8E", fontSize: 10, width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {links.map((link, i) => (
            <tr key={i} style={{ borderBottom: i < links.length - 1 ? "1px solid #F0F0F0" : "none" }}>
              <td style={{ padding: "8px 14px" }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600, color: "#6B21A8", fontSize: 11 }}>
                  {getFlag(link.locale)} {link.locale}
                </span>
              </td>
              <td style={{ padding: "8px 14px", color: "#1A1A1A", fontWeight: 500 }}>{link.language}</td>
              {!compact && (
                <td style={{ padding: "8px 14px", fontWeight: 600, color: "#1A1A1A", whiteSpace: "nowrap" }}>{link.rate || "—"}</td>
              )}
              <td style={{ padding: "8px 14px" }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#0693E3" }}>
                  {link.url.length > 45 ? link.url.slice(0, 45) + "..." : link.url}
                </span>
              </td>
              <td style={{ padding: "8px 14px", textAlign: "center" }}>
                <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                  <button
                    onClick={() => handleCopy(link.url)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 4, color: "#8A8A8E", display: "flex" }}
                    title="Copy link"
                  >
                    <Copy size={12} />
                  </button>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: 4, borderRadius: 4, color: "#8A8A8E", display: "flex" }}
                    title="Open"
                  >
                    <ExternalLink size={12} />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
