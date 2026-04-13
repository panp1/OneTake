#!/usr/bin/env node
/**
 * Export workflow HTML slides → editable PPTX for Canva import.
 *
 * Strategy (from TailoredVets export-canva.mjs):
 *   1. Extract text element positions + computed styles from live DOM
 *   2. Hide text → screenshot each slide as background-only PNG (300 DPI)
 *   3. Build PPTX: PNG background + transparent editable text overlays
 *
 * Usage:
 *   node export-pptx.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PptxGenJS from "pptxgenjs";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 16:9 widescreen slide
const SLIDE_W_IN = 13.333;
const SLIDE_H_IN = 7.5;
const SLIDE_W_PX = 1440;
const SLIDE_H_PX = 810;
const DPI = 300;
const CSS_PPI = 96;
const SCALE = DPI / CSS_PPI;

const SLIDE_FILES = [
  { file: "1-recruiter-workflow.html", name: "Recruiter Workflow" },
  { file: "2-marketing-manager.html", name: "Marketing Manager Workflow" },
  { file: "3-designer-workflow.html", name: "Designer Workflow" },
  { file: "4-agency-workflow.html", name: "Agency Portal Workflow" },
  { file: "5-system-pipeline.html", name: "System Pipeline" },
  { file: "6-team-process.html", name: "Team Process" },
];

const FONT_MAP = {
  "-apple-system": "Helvetica Neue",
  "system-ui": "Helvetica Neue",
  "Segoe UI": "Segoe UI",
  "Roboto": "Roboto",
};

async function main() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=none",
      "--force-color-profile=srgb",
    ],
  });

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE16x9", width: SLIDE_W_IN, height: SLIDE_H_IN });
  pptx.layout = "WIDE16x9";
  pptx.author = "Nova Creative Operations";
  pptx.title = "Nova Workflow Maps — OneForma";

  for (const { file, name } of SLIDE_FILES) {
    const htmlPath = path.join(__dirname, file);
    if (!fs.existsSync(htmlPath)) {
      console.log(`  SKIP ${file} — not found`);
      continue;
    }

    console.log(`\nProcessing: ${name}`);
    const page = await browser.newPage();

    // Set viewport to EXACTLY the slide dimensions — no centering, no flex
    await page.setViewport({
      width: SLIDE_W_PX,
      height: SLIDE_H_PX,
      deviceScaleFactor: SCALE,
    });

    await page.goto(`file://${htmlPath}`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });

    await page.evaluate(() => document.fonts.ready);

    // Force the slide to fill the viewport exactly — remove centering/padding
    await page.addStyleTag({
      content: `
        body {
          display: block !important;
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
          min-height: auto !important;
          overflow: hidden !important;
        }
        .slide {
          width: 1440px !important;
          height: 810px !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
        }
      `,
    });

    // Give layout a tick to settle
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    // ── Extract text elements ──
    console.log("  Extracting text...");

    const TEXT_SELECTOR =
      ".c h3, .c p, .c li, .c .m, .note, .title, .tag, .leg span, " +
      ".nova-tag, .card-title, .card-sub, .card-desc, .card-meta, .card-badge";

    const texts = await page.evaluate((selector, slideW, slideH) => {
      const slideEl = document.querySelector(".slide");
      if (!slideEl) return [];

      const slideRect = slideEl.getBoundingClientRect();
      const candidates = slideEl.querySelectorAll(selector);
      const seen = new Set();
      const result = [];

      candidates.forEach((el) => {
        const text = el.textContent?.trim();
        if (!text || text.length === 0) return;

        // Prefer leaf nodes — skip if has child matches
        const hasTextChildren = el.querySelector(selector);
        if (hasTextChildren) return;

        const rect = el.getBoundingClientRect();
        if (rect.width < 5 || rect.height < 5) return;

        // Dedup
        const key = `${Math.round(rect.x)}-${Math.round(rect.y)}-${text.slice(0, 15)}`;
        if (seen.has(key)) return;
        seen.add(key);

        const style = getComputedStyle(el);
        const x = rect.left - slideRect.left;
        const y = rect.top - slideRect.top;

        result.push({
          text,
          x: x / slideW,
          y: y / slideH,
          w: rect.width / slideW,
          h: rect.height / slideH,
          fontSize: parseFloat(style.fontSize),
          fontFamily: style.fontFamily.split(",")[0].replace(/['"]/g, "").trim(),
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          color: style.color,
          textAlign: style.textAlign,
          letterSpacing: parseFloat(style.letterSpacing) || 0,
          textTransform: style.textTransform,
          lineHeight: parseFloat(style.lineHeight) / parseFloat(style.fontSize) || 1.4,
        });
      });

      return result;
    }, TEXT_SELECTOR, SLIDE_W_PX, SLIDE_H_PX);

    console.log(`  Found ${texts.length} text elements`);

    // ── Hide ALL text for background-only screenshot ──
    console.log("  Hiding text for background capture...");
    await page.addStyleTag({
      content: `
        .__txt-hide {
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          text-shadow: none !important;
        }
      `,
    });
    await page.evaluate((selector) => {
      // Hide all text-bearing elements
      const allText = "H1,H2,H3,H4,H5,H6,P,SPAN,LI,A";
      document.querySelectorAll(allText).forEach((el) => el.classList.add("__txt-hide"));
      // Also hide our custom classes
      document.querySelectorAll(
        ".title,.tag,.note,.m,.leg,.nova-tag,.card-title,.card-sub,.card-desc,.card-meta,.card-badge"
      ).forEach((el) => el.classList.add("__txt-hide"));
    }, TEXT_SELECTOR);

    // ── Screenshot (text-free) ──
    console.log("  Capturing background...");
    const screenshotBuf = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: SLIDE_W_PX, height: SLIDE_H_PX },
      omitBackground: false,
    });

    await page.close();

    // ── Build slide ──
    console.log("  Building slide...");
    const slide = pptx.addSlide();

    // Background image (text-free) — added FIRST
    const b64 = Buffer.from(screenshotBuf).toString("base64");
    slide.addImage({
      data: `image/png;base64,${b64}`,
      x: 0,
      y: 0,
      w: SLIDE_W_IN,
      h: SLIDE_H_IN,
    });

    // Editable text overlays — added AFTER (on top)
    let added = 0;
    for (const t of texts) {
      const x = t.x * SLIDE_W_IN;
      const y = t.y * SLIDE_H_IN;
      const w = t.w * SLIDE_W_IN;
      const h = t.h * SLIDE_H_IN;

      if (w < 0.1 || h < 0.05) continue;
      if (x < -0.2 || y < -0.2 || x > SLIDE_W_IN || y > SLIDE_H_IN) continue;

      const color = cssColorToHex(t.color);
      const fontSize = Math.round(t.fontSize * 0.75 * 10) / 10;
      const fontFace = FONT_MAP[t.fontFamily] || t.fontFamily || "Helvetica Neue";

      let text = t.text;
      if (t.textTransform === "uppercase") text = text.toUpperCase();

      const isBold =
        t.fontWeight === "bold" ||
        t.fontWeight === "700" ||
        t.fontWeight === "600" ||
        parseInt(t.fontWeight) >= 600;

      const align =
        t.textAlign === "center" ? "center" :
        t.textAlign === "right" ? "right" :
        "left";

      slide.addText(text, {
        x,
        y,
        w: w + 0.08,
        h: h + 0.08,
        fontSize,
        fontFace,
        color,
        bold: isBold,
        italic: t.fontStyle === "italic",
        align,
        valign: "top",
        lineSpacingMultiple: t.lineHeight > 0 ? t.lineHeight : 1.4,
        charSpacing: t.letterSpacing > 0 ? t.letterSpacing * 0.75 : undefined,
        transparency: 0,
        fill: { type: "none" },
        line: { type: "none" },
        margin: [0, 0, 0, 0],
        wrap: true,
        shrinkText: false,
      });
      added++;
    }

    console.log(`  ✓ ${name} — ${added} editable text boxes on top of background`);
  }

  await browser.close();

  const outputPath = path.join(__dirname, "Nova_Workflow_Maps.pptx");
  await pptx.writeFile({ fileName: outputPath });

  const sizeMb = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Exported: ${outputPath}`);
  console.log(`   Size: ${sizeMb} MB`);
  console.log(`   6 slides — background PNG + editable text overlays`);
}

function cssColorToHex(cssColor) {
  if (!cssColor) return "000000";
  const match = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return "000000";
  const [, r, g, b] = match.map(Number);
  return [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
