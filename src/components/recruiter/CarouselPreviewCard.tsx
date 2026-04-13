"use client";

import { useState } from "react";
import { Copy, Download, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import type { GeneratedAsset } from "@/lib/types";

interface CarouselPreviewCardProps {
  asset: GeneratedAsset;
}

// ── Real platform logos (inline SVG) ─────────────────────────────────

const LINKEDIN_LOGO = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const IG_LOGO = (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <defs>
      <linearGradient id="ig-grad-card" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#feda75" />
        <stop offset="25%" stopColor="#fa7e1e" />
        <stop offset="50%" stopColor="#d62976" />
        <stop offset="75%" stopColor="#962fbf" />
        <stop offset="100%" stopColor="#4f5bd5" />
      </linearGradient>
    </defs>
    <path
      fill="url(#ig-grad-card)"
      d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
    />
  </svg>
);

// ── Component ────────────────────────────────────────────────────────

export default function CarouselPreviewCard({ asset }: CarouselPreviewCardProps) {
  const content = (asset.content ?? {}) as Record<string, unknown>;
  const caption = String(content.caption ?? "");
  const slideUrls = (content.slide_urls ?? []) as string[];
  const platform = String(content.platform ?? asset.platform ?? "").toLowerCase();
  const isLinkedIn = platform.includes("linkedin");

  const [currentSlide, setCurrentSlide] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    toast.success("Caption copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    for (const url of slideUrls) {
      if (url) window.open(url, "_blank");
    }
    toast.success(`Downloading ${slideUrls.length} slides...`);
  };

  const nextSlide = () => setCurrentSlide((p) => Math.min(p + 1, slideUrls.length - 1));
  const prevSlide = () => setCurrentSlide((p) => Math.max(p - 1, 0));

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        border: "1px solid #E5E5E5",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Platform header ── */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid #F5F5F5",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: isLinkedIn ? "#E8F0FE" : "linear-gradient(135deg, #f09433, #dc2743, #bc1888)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isLinkedIn ? LINKEDIN_LOGO : IG_LOGO}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1A1A" }}>
            {isLinkedIn ? "Maria Solana" : "maria.recruiter"}
          </div>
          <div style={{ fontSize: 10, color: "#737373" }}>
            {isLinkedIn ? "Recruiter at OneForma \u00b7 Just now" : "OneForma"}
          </div>
        </div>
      </div>

      {/* ── LinkedIn: caption above slides ── */}
      {isLinkedIn && caption && (
        <div
          style={{
            padding: "10px 14px",
            fontSize: 12,
            color: "#334155",
            lineHeight: 1.55,
            borderBottom: "1px solid #F5F5F5",
            whiteSpace: "pre-wrap",
          }}
        >
          {caption.length > 280 ? caption.slice(0, 280) + "..." : caption}
        </div>
      )}

      {/* ── Slide viewer ── */}
      <div
        style={{
          position: "relative",
          aspectRatio: isLinkedIn ? "1" : "4/5",
          background: "#0a0a0f",
          overflow: "hidden",
        }}
      >
        {slideUrls[currentSlide] ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={slideUrls[currentSlide]}
            alt={`Slide ${currentSlide + 1}`}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#475569",
              fontSize: 13,
            }}
          >
            No slides generated
          </div>
        )}

        {/* Nav arrows */}
        {currentSlide > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prevSlide(); }}
            style={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.9)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            }}
          >
            <ChevronLeft size={16} color="#1A1A1A" />
          </button>
        )}
        {currentSlide < slideUrls.length - 1 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); nextSlide(); }}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.9)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            }}
          >
            <ChevronRight size={16} color="#1A1A1A" />
          </button>
        )}

        {/* Slide counter */}
        {slideUrls.length > 1 && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 9999,
            }}
          >
            {currentSlide + 1}/{slideUrls.length}
          </div>
        )}
      </div>

      {/* ── Dot indicators ── */}
      {slideUrls.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 4, padding: "8px 0" }}>
          {slideUrls.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentSlide(i)}
              style={{
                width: i === currentSlide ? 16 : 6,
                height: 6,
                borderRadius: 3,
                border: "none",
                background: i === currentSlide ? (isLinkedIn ? "#0A66C2" : "#E1306C") : "#D4D4D4",
                transition: "width 0.2s, background 0.2s",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* ── IG: caption below slides ── */}
      {!isLinkedIn && caption && (
        <div
          style={{
            padding: "6px 14px 10px",
            fontSize: 12,
            color: "#334155",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          <span style={{ fontWeight: 700 }}>maria.recruiter</span>{" "}
          {caption.length > 200 ? caption.slice(0, 200) + "..." : caption}
        </div>
      )}

      {/* ── Action buttons ── */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid #F5F5F5",
          display: "flex",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={handleCopy}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px 0",
            borderRadius: 8,
            border: "1px solid #E5E5E5",
            background: "#FFFFFF",
            fontSize: 12,
            fontWeight: 600,
            color: "#1A1A1A",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
          {copied ? "Copied!" : "Copy Caption"}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            background: "#32373C",
            fontSize: 12,
            fontWeight: 600,
            color: "#FFFFFF",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Download size={14} />
          Download Slides
        </button>
      </div>
    </div>
  );
}
