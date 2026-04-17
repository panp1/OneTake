"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, X, Globe, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────

export interface LocaleLink {
  locale: string;
  language: string;
  url: string;
  location: string;
  rate: string;
  payment_qualification: string;
  additional_url?: string;
  additional_purpose?: string;
}

interface LocaleLinksUploadProps {
  value: LocaleLink[];
  onChange: (links: LocaleLink[]) => void;
}

// ── Parser ────────────────────────────────────────────────────────────

async function parseXlsx(file: File): Promise<LocaleLink[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  // Find the data sheet — prefer "Template", fall back to second sheet, then first
  let sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("template"));
  if (!sheetName && wb.SheetNames.length > 1) sheetName = wb.SheetNames[1];
  if (!sheetName) sheetName = wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Find header row (look for "LP/Language" or "Locale" in first few rows)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (row && row.some((c) => String(c || "").toLowerCase().includes("locale") || String(c || "").toLowerCase().includes("lp/"))) {
      headerIdx = i;
      break;
    }
  }

  const links: LocaleLink[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue; // skip empty rows

    const locale = String(row[0] || "").trim();
    const language = String(row[1] || "").trim();
    const url = String(row[2] || "").trim();

    if (!locale || !url) continue;

    links.push({
      locale,
      language,
      url,
      location: String(row[3] || "Remote").trim(),
      rate: String(row[4] || "").trim(),
      payment_qualification: String(row[5] || "").trim(),
      additional_url: row[6] ? String(row[6]).trim() : undefined,
      additional_purpose: row[7] ? String(row[7]).trim() : undefined,
    });
  }

  return links;
}

// ── Component ─────────────────────────────────────────────────────────

export default function LocaleLinksUpload({ value, onChange }: LocaleLinksUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.match(/\.xlsx?$/i)) {
        toast.error("Please upload an Excel file (.xlsx)");
        return;
      }
      setParsing(true);
      try {
        const links = await parseXlsx(file);
        if (links.length === 0) {
          toast.error("No locale links found in the spreadsheet. Check the format.");
          return;
        }
        onChange(links);
        setFileName(file.name);
        toast.success(`Parsed ${links.length} locale links`);
      } catch (err) {
        console.error("XLSX parse error:", err);
        toast.error("Failed to parse Excel file");
      } finally {
        setParsing(false);
      }
    },
    [onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleClear = () => {
    onChange([]);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // ── Render: parsed results table ────────────────────────────────

  if (value.length > 0) {
    return (
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileSpreadsheet size={16} style={{ color: "#22c55e" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A" }}>
              {value.length} Locale Links
            </span>
            {fileName && (
              <span style={{ fontSize: 11, color: "#8A8A8E" }}>
                from {fileName}
              </span>
            )}
          </div>
          <button
            onClick={handleClear}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              color: "#8A8A8E",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            <X size={12} />
            Clear
          </button>
        </div>

        {/* Table */}
        <div style={{ border: "1px solid #E8E8EA", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #E8E8EA" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#8A8A8E", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Locale</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#8A8A8E", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Language</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#8A8A8E", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>OneForma Link</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#8A8A8E", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Rate</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#8A8A8E", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Location</th>
              </tr>
            </thead>
            <tbody>
              {value.map((link, i) => (
                <tr key={i} style={{ borderBottom: i < value.length - 1 ? "1px solid #F0F0F0" : "none" }}>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600, color: "#6B21A8", fontSize: 11 }}>{link.locale}</span>
                  </td>
                  <td style={{ padding: "8px 12px", color: "#1A1A1A" }}>{link.language}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#0693E3", fontFamily: "ui-monospace, monospace", fontSize: 11, textDecoration: "none" }}
                    >
                      {link.url.length > 50 ? link.url.slice(0, 50) + "..." : link.url}
                    </a>
                  </td>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1A1A1A", whiteSpace: "nowrap" }}>{link.rate}</td>
                  <td style={{ padding: "8px 12px", color: "#8A8A8E" }}>{link.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Render: drop zone ───────────────────────────────────────────

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? "#6B21A8" : "#E8E8EA"}`,
          borderRadius: 12,
          padding: "28px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: dragOver ? "rgba(107,33,168,0.03)" : "#FAFAFA",
          transition: "all 0.15s",
        }}
      >
        {parsing ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ width: 20, height: 20, border: "2px solid #6B21A8", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6B21A8" }}>Parsing spreadsheet...</span>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, rgba(6,147,227,0.1), rgba(155,81,224,0.1))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Upload size={18} style={{ color: "#6B21A8" }} />
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
              Drop locale links spreadsheet here
            </div>
            <div style={{ fontSize: 11, color: "#8A8A8E" }}>
              OneForma Locales &amp; Links Excel file (.xlsx) — auto-parsed
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
