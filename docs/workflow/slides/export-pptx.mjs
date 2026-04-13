#!/usr/bin/env node
/**
 * Export workflow HTML slides → editable PPTX for Canva import.
 *
 * Strategy (from TailoredVets pattern):
 *   1. Hide text → screenshot each slide as background-only PNG (300 DPI)
 *   2. Extract text element positions + computed styles from live DOM
 *   3. Build PPTX: PNG background + transparent editable text overlays
 *
 * Result: pixel-perfect backgrounds with fully editable text in Canva/PowerPoint.
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
const CSS_PPI = 96;
const SLIDE_W_PX = 1440;
const SLIDE_H_PX = 810;
const DPI = 300;
const SCALE = DPI / CSS_PPI;

const SLIDE_FILES = [
  { file: "1-recruiter-workflow.html", name: "Recruiter Workflow" },
  { file: "2-marketing-manager.html", name: "Marketing Manager Workflow" },
  { file: "3-designer-workflow.html", name: "Designer Workflow" },
  { file: "4-agency-workflow.html", name: "Agency Portal Workflow" },
  { file: "5-system-pipeline.html", name: "System Pipeline" },
  { file: "6-team-process.html", name: "Team Process" },
];

// CSS → PPTX font mapping
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
    await page.setViewport({
      width: SLIDE_W_PX,
      height: SLIDE_H_PX,
      deviceScaleFactor: SCALE,
    });

    await page.goto(`file://${htmlPath}`, {
      waitUntil: "networkidle0",
      timeout: 15000,
    });

    // Wait for fonts
    await page.evaluate(() => document.fonts.ready);

    // ── Extract text element positions + styles ──
    console.log("  Extracting text...");
    const texts = await page.evaluate((slideW, slideH) => {
      const SELECTOR = "h3, p, li, .m, .note, .title, .tag, .leg span";
      const slideEl = document.querySelector(".slide");
      if (!slideEl) return [];

      const slideRect = slideEl.getBoundingClientRect();
      const candidates = slideEl.querySelectorAll(SELECTOR);
      const seen = new Set();
      const result = [];

      candidates.forEach((el) => {
        const text = el.textContent?.trim();
        if (!text || text.length === 0) return;

        // Skip if has children matching our selector (prefer leaf nodes)
        if (el.querySelector(SELECTOR) && el.tagName !== "LI") return;

        const rect = el.getBoundingClientRect();
        if (rect.width < 5 || rect.height < 5) return;

        // Dedup by position
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
    }, SLIDE_W_PX, SLIDE_H_PX);

    console.log(`  Found ${texts.length} text elements`);

    // ── Hide text for background-only screenshot ──
    console.log("  Capturing background...");
    await page.addStyleTag({
      content: `
        h3, p, li, span, .m, .note, .title, .tag,
        .leg span, .leg i, .leg {
          color: transparent !important;
          -webkit-text-fill-color: transparent !important;
          text-shadow: none !important;
        }
        /* Keep card borders, arrows, gradient visible */
      `,
    });

    const slideEl = await page.$(".slide");
    const screenshotBuf = await slideEl.screenshot({ type: "png", omitBackground: false });

    await page.close();

    // ── Build slide ──
    console.log("  Building slide...");
    const slide = pptx.addSlide();

    // Background image (text-free)
    const b64 = Buffer.from(screenshotBuf).toString("base64");
    slide.addImage({
      data: `image/png;base64,${b64}`,
      x: 0,
      y: 0,
      w: SLIDE_W_IN,
      h: SLIDE_H_IN,
    });

    // Editable text overlays
    for (const t of texts) {
      const x = t.x * SLIDE_W_IN;
      const y = t.y * SLIDE_H_IN;
      const w = t.w * SLIDE_W_IN;
      const h = t.h * SLIDE_H_IN;

      if (w < 0.1 || h < 0.06) continue;
      if (x < -0.5 || y < -0.5 || x > SLIDE_W_IN || y > SLIDE_H_IN) continue;

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

      const align = t.textAlign === "center" ? "center"
        : t.textAlign === "right" ? "right"
        : "left";

      slide.addText(text, {
        x,
        y,
        w: w + 0.05,
        h: h + 0.05,
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
        margin: 0,
        wrap: true,
        shrinkText: false,
      });
    }

    console.log(`  ✓ ${name} — ${texts.length} editable text boxes`);
  }

  await browser.close();

  // Save
  const outputPath = path.join(__dirname, "Nova_Workflow_Maps.pptx");
  await pptx.writeFile({ fileName: outputPath });

  const sizeMb = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Exported: ${outputPath}`);
  console.log(`   Size: ${sizeMb} MB`);
  console.log(`   6 slides with editable text overlays`);
  console.log(`\nCanva import:`);
  console.log(`  1. canva.com → Upload → select Nova_Workflow_Maps.pptx`);
  console.log(`  2. Each slide imports with editable text`);
  console.log(`  3. Click any text to edit directly`);
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
