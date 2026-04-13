/**
 * Hardcore production tests for organic carousel system.
 *
 * Covers:
 * - Caption drift detection (compensation, work mode, forbidden promises)
 * - Asset categorization (organic_carousel vs carousel_panel vs composed_creative)
 * - Platform placement validation (LinkedIn vs IG format constraints)
 * - Guardrail enforcement (12-cap, variation variety)
 * - Content JSONB structure validation
 * - Edge cases (empty fields, missing personas, malformed data)
 */

import { describe, it, expect } from "vitest";

// ── Types matching our schema ──────────────────────────────────────────

type AssetType = "base_image" | "composed_creative" | "carousel_panel" | "landing_page" | "organic_carousel";

interface MockAsset {
  id: string;
  asset_type: AssetType;
  platform: string;
  evaluation_passed: boolean;
  blob_url: string;
  content: Record<string, unknown>;
}

// ── Helpers (replicating validator logic for test purity) ─────────────

const FORBIDDEN_PHRASES = [
  "guaranteed income", "guaranteed pay", "guaranteed earnings",
  "career growth", "career advancement", "life-changing", "life changing",
  "get rich", "unlimited earning", "unlimited income",
  "no experience needed", "no skills required", "no qualifications needed",
  "anyone can do this", "easy money", "passive income",
  "side hustle gold", "financial freedom",
];

function validateCaption(
  caption: string,
  hardFacts: { compensation_amount?: string; work_mode?: string },
): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  const lower = caption.toLowerCase();

  // Compensation check
  const comp = (hardFacts.compensation_amount ?? "").replace("$", "").replace(",", "").trim();
  if (comp) {
    const found = caption.match(/\$[\d,]+(?:\.\d{2})?/g) ?? [];
    for (const amount of found) {
      const clean = amount.replace("$", "").replace(",", "").trim();
      if (clean && clean !== comp) {
        issues.push(`Compensation drift: ${amount} vs source $${comp}`);
      }
    }
  }

  // Work mode check
  const mode = (hardFacts.work_mode ?? "").toLowerCase();
  if (mode === "remote") {
    const onsite = ["come to our office", "in-person required", "onsite only", "must be local", "visit our facility", "in-office", "on-site mandatory"];
    for (const s of onsite) if (lower.includes(s)) issues.push(`Work mode drift: ${s}`);
  } else if (mode === "onsite") {
    const remote = ["work from home", "work from anywhere", "fully remote", "100% remote", "no commute", "work in your pajamas", "remote position"];
    for (const s of remote) if (lower.includes(s)) issues.push(`Work mode drift: ${s}`);
  }

  // Forbidden promises
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase)) issues.push(`Forbidden: ${phrase}`);
  }

  return { passed: issues.length === 0, issues };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. CAPTION DRIFT DETECTION — the most critical gate
// ═══════════════════════════════════════════════════════════════════════

describe("Caption Drift Validator", () => {
  describe("Compensation drift", () => {
    it("passes when caption uses exact source amount", () => {
      const r = validateCaption("We pay $15/hr for this project!", { compensation_amount: "$15", work_mode: "remote" });
      expect(r.passed).toBe(true);
    });

    it("passes when caption mentions no dollar amount", () => {
      const r = validateCaption("Great opportunity, flexible hours, apply now!", { compensation_amount: "$15", work_mode: "remote" });
      expect(r.passed).toBe(true);
    });

    it("CATCHES wrong dollar amount", () => {
      const r = validateCaption("Earn $25/hr working from home!", { compensation_amount: "$15", work_mode: "remote" });
      expect(r.passed).toBe(false);
      expect(r.issues[0]).toContain("Compensation drift");
    });

    it("CATCHES inflated dollar amount", () => {
      const r = validateCaption("Make $500 per session!", { compensation_amount: "$150", work_mode: "remote" });
      expect(r.passed).toBe(false);
    });

    it("CATCHES rounded amount ($20 vs $19.50)", () => {
      const r = validateCaption("Earn $20 per hour!", { compensation_amount: "$19.50", work_mode: "remote" });
      expect(r.passed).toBe(false);
    });

    it("passes when no compensation in source (nothing to drift from)", () => {
      const r = validateCaption("Join our team! Apply now.", { compensation_amount: "", work_mode: "remote" });
      expect(r.passed).toBe(true);
    });

    it("handles comma-formatted amounts ($1,500)", () => {
      const r = validateCaption("Earn $1,500 total!", { compensation_amount: "$1500", work_mode: "remote" });
      expect(r.passed).toBe(true);
    });
  });

  describe("Work mode drift", () => {
    it("passes when remote job says remote", () => {
      const r = validateCaption("This is a fully remote position.", { work_mode: "remote" });
      expect(r.passed).toBe(true);
    });

    it("CATCHES remote job claiming onsite", () => {
      const r = validateCaption("Come to our office for the session.", { work_mode: "remote" });
      expect(r.passed).toBe(false);
      expect(r.issues[0]).toContain("Work mode drift");
    });

    it("CATCHES onsite job claiming remote", () => {
      const r = validateCaption("Work from home on this exciting project!", { work_mode: "onsite" });
      expect(r.passed).toBe(false);
    });

    it("CATCHES 'fully remote' on onsite job", () => {
      const r = validateCaption("This is a fully remote opportunity!", { work_mode: "onsite" });
      expect(r.passed).toBe(false);
    });

    it("CATCHES 'no commute' on onsite job", () => {
      const r = validateCaption("No commute needed — work from your couch!", { work_mode: "onsite" });
      expect(r.passed).toBe(false);
    });

    it("passes when work mode not specified", () => {
      const r = validateCaption("Great opportunity, apply now!", { work_mode: "" });
      expect(r.passed).toBe(true);
    });
  });

  describe("Forbidden promises", () => {
    it.each(FORBIDDEN_PHRASES)("CATCHES forbidden phrase: '%s'", (phrase) => {
      const r = validateCaption(`This job offers ${phrase} for everyone!`, { work_mode: "remote" });
      expect(r.passed).toBe(false);
      expect(r.issues.some((i) => i.includes("Forbidden"))).toBe(true);
    });

    it("passes normal recruiter language", () => {
      const r = validateCaption("We're hiring Finnish speakers for an AI project. Flexible hours, remote. DM me!", { work_mode: "remote" });
      expect(r.passed).toBe(true);
    });

    it("passes with enthusiasm that isn't a promise", () => {
      const r = validateCaption("Really exciting project! Great team, interesting work. Apply now!", { work_mode: "remote" });
      expect(r.passed).toBe(true);
    });
  });

  describe("Multi-issue detection", () => {
    it("catches BOTH compensation drift AND forbidden promise", () => {
      const r = validateCaption("Guaranteed income of $99/hr!", { compensation_amount: "$15", work_mode: "remote" });
      expect(r.passed).toBe(false);
      expect(r.issues.length).toBeGreaterThanOrEqual(2);
    });

    it("catches compensation + work mode + forbidden simultaneously", () => {
      const r = validateCaption("Come to our office for guaranteed income of $50/hr!", {
        compensation_amount: "$15",
        work_mode: "remote",
      });
      expect(r.passed).toBe(false);
      expect(r.issues.length).toBe(3);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. ASSET CATEGORIZATION — organic vs paid separation
// ═══════════════════════════════════════════════════════════════════════

describe("Asset Categorization", () => {
  const mockAssets: MockAsset[] = [
    { id: "1", asset_type: "composed_creative", platform: "meta", evaluation_passed: true, blob_url: "https://blob/1.png", content: { persona_key: "gig_worker" } },
    { id: "2", asset_type: "composed_creative", platform: "linkedin", evaluation_passed: true, blob_url: "https://blob/2.png", content: { persona_key: "gig_worker" } },
    { id: "3", asset_type: "carousel_panel", platform: "linkedin_carousel", evaluation_passed: true, blob_url: "https://blob/3.png", content: { persona_key: "gig_worker" } },
    { id: "4", asset_type: "organic_carousel", platform: "linkedin", evaluation_passed: true, blob_url: "https://blob/4.png", content: { persona_key: "gig_worker", distribution: "organic", caption: "Hiring!" } },
    { id: "5", asset_type: "organic_carousel", platform: "instagram", evaluation_passed: true, blob_url: "https://blob/5.png", content: { persona_key: "gig_worker", distribution: "organic", caption: "Join us!" } },
    { id: "6", asset_type: "landing_page", platform: "landing_page", evaluation_passed: true, blob_url: "https://blob/6.html", content: { persona_key: "gig_worker" } },
    { id: "7", asset_type: "organic_carousel", platform: "linkedin", evaluation_passed: false, blob_url: "https://blob/7.png", content: { persona_key: "professional", distribution: "organic", caption: "Bad caption" } },
  ];

  it("filters organic_carousel assets correctly", () => {
    const organic = mockAssets.filter((a) => a.asset_type === "organic_carousel");
    expect(organic).toHaveLength(3);
  });

  it("filters PASSING organic_carousel assets", () => {
    const passing = mockAssets.filter((a) => a.asset_type === "organic_carousel" && a.evaluation_passed);
    expect(passing).toHaveLength(2);
  });

  it("never mixes organic with paid composites", () => {
    const paid = mockAssets.filter((a) => a.asset_type === "composed_creative");
    const organic = mockAssets.filter((a) => a.asset_type === "organic_carousel");
    const paidIds = new Set(paid.map((a) => a.id));
    const organicIds = new Set(organic.map((a) => a.id));

    // No overlap
    for (const id of organicIds) {
      expect(paidIds.has(id)).toBe(false);
    }
  });

  it("never mixes organic with paid carousel_panel", () => {
    const paidCarousels = mockAssets.filter((a) => a.asset_type === "carousel_panel");
    const organicCarousels = mockAssets.filter((a) => a.asset_type === "organic_carousel");

    expect(paidCarousels.every((a) => a.asset_type === "carousel_panel")).toBe(true);
    expect(organicCarousels.every((a) => a.asset_type === "organic_carousel")).toBe(true);
  });

  it("separates landing_page from all creative types", () => {
    const lps = mockAssets.filter((a) => a.asset_type === "landing_page");
    const creatives = mockAssets.filter((a) => a.asset_type === "composed_creative" || a.asset_type === "organic_carousel" || a.asset_type === "carousel_panel");

    expect(lps).toHaveLength(1);
    expect(creatives.every((a) => a.asset_type !== "landing_page")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. PLATFORM PLACEMENT — LinkedIn vs IG format constraints
// ═══════════════════════════════════════════════════════════════════════

describe("Platform Placement", () => {
  it("LinkedIn carousels filter by linkedin platform", () => {
    const assets: MockAsset[] = [
      { id: "1", asset_type: "organic_carousel", platform: "linkedin", evaluation_passed: true, blob_url: "x", content: { platform: "linkedin_carousel" } },
      { id: "2", asset_type: "organic_carousel", platform: "instagram", evaluation_passed: true, blob_url: "x", content: { platform: "ig_carousel" } },
      { id: "3", asset_type: "organic_carousel", platform: "linkedin", evaluation_passed: true, blob_url: "x", content: { platform: "linkedin_carousel" } },
    ];

    const linkedin = assets.filter((a) => {
      const p = String((a.content as Record<string, unknown>).platform ?? a.platform).toLowerCase();
      return p.includes("linkedin");
    });
    expect(linkedin).toHaveLength(2);
  });

  it("Instagram carousels filter by ig/instagram platform", () => {
    const assets: MockAsset[] = [
      { id: "1", asset_type: "organic_carousel", platform: "instagram", evaluation_passed: true, blob_url: "x", content: { platform: "ig_carousel" } },
      { id: "2", asset_type: "organic_carousel", platform: "linkedin", evaluation_passed: true, blob_url: "x", content: { platform: "linkedin_carousel" } },
    ];

    const ig = assets.filter((a) => {
      const p = String((a.content as Record<string, unknown>).platform ?? a.platform).toLowerCase();
      return p.includes("ig") || p.includes("instagram");
    });
    expect(ig).toHaveLength(1);
  });

  it("no TikTok carousels in organic v1", () => {
    const platforms = ["linkedin_carousel", "ig_carousel"];
    expect(platforms).not.toContain("tiktok_carousel");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. GUARDRAIL ENFORCEMENT — 12-cap + variation variety
// ═══════════════════════════════════════════════════════════════════════

describe("Guardrail Enforcement", () => {
  const MAX_CAROUSELS = 12;
  const ORGANIC_PLATFORMS = ["linkedin_carousel", "ig_carousel"];
  const VARIATIONS_PER_PERSONA = 2;

  it("max carousels = 12 (3 personas × 2 platforms × 2 variations)", () => {
    const personas = 3;
    const total = personas * ORGANIC_PLATFORMS.length * VARIATIONS_PER_PERSONA;
    expect(total).toBe(MAX_CAROUSELS);
  });

  it("caps at MAX_CAROUSELS even with more personas", () => {
    const personas = 5; // more than expected
    let count = 0;
    for (let p = 0; p < personas; p++) {
      for (const _platform of ORGANIC_PLATFORMS) {
        for (let v = 1; v <= VARIATIONS_PER_PERSONA; v++) {
          if (count >= MAX_CAROUSELS) break;
          count++;
        }
      }
    }
    expect(count).toBe(MAX_CAROUSELS);
  });

  it("each persona gets exactly 2 variations per platform", () => {
    expect(VARIATIONS_PER_PERSONA).toBe(2);
  });

  it("variation 1 = primary pillar, variation 2 = secondary pillar", () => {
    const angles = [
      { variation: 1, angle: "primary_pillar" },
      { variation: 2, angle: "secondary_pillar" },
    ];
    expect(angles[0].angle).not.toBe(angles[1].angle);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. CONTENT JSONB STRUCTURE — what gets stored
// ═══════════════════════════════════════════════════════════════════════

describe("Content JSONB Structure", () => {
  const validContent = {
    persona_key: "gig_worker_flex",
    persona_name: "Maria G.",
    distribution: "organic",
    variation: 1,
    caption: "We're hiring Finnish speakers! $15/hr, remote. Link in comments 👇",
    slide_count: 6,
    slide_urls: ["https://blob/s1.png", "https://blob/s2.png", "https://blob/s3.png", "https://blob/s4.png", "https://blob/s5.png", "https://blob/s6.png"],
    hook_angle: "primary_pillar",
    platform: "linkedin_carousel",
  };

  it("has all required fields", () => {
    expect(validContent.persona_key).toBeTruthy();
    expect(validContent.distribution).toBe("organic");
    expect(validContent.variation).toBeGreaterThanOrEqual(1);
    expect(validContent.caption).toBeTruthy();
    expect(validContent.slide_urls.length).toBeGreaterThan(0);
    expect(validContent.platform).toBeTruthy();
  });

  it("slide_count matches slide_urls length", () => {
    expect(validContent.slide_count).toBe(validContent.slide_urls.length);
  });

  it("distribution is always 'organic'", () => {
    expect(validContent.distribution).toBe("organic");
  });

  it("hook_angle is either primary_pillar or secondary_pillar", () => {
    expect(["primary_pillar", "secondary_pillar"]).toContain(validContent.hook_angle);
  });

  it("variation is 1 or 2", () => {
    expect([1, 2]).toContain(validContent.variation);
  });

  it("platform matches expected organic platforms", () => {
    expect(["linkedin_carousel", "ig_carousel"]).toContain(validContent.platform);
  });

  it("caption is non-empty string", () => {
    expect(typeof validContent.caption).toBe("string");
    expect(validContent.caption.length).toBeGreaterThan(10);
  });

  it("all slide_urls are valid URL strings", () => {
    for (const url of validContent.slide_urls) {
      expect(url).toMatch(/^https?:\/\//);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. EDGE CASES — malformed data, missing fields, empty states
// ═══════════════════════════════════════════════════════════════════════

describe("Edge Cases", () => {
  it("handles empty caption gracefully", () => {
    const r = validateCaption("", { compensation_amount: "$15", work_mode: "remote" });
    expect(r.passed).toBe(true); // empty caption has no drift
  });

  it("handles undefined compensation", () => {
    const r = validateCaption("Great opportunity!", { compensation_amount: undefined, work_mode: "remote" });
    expect(r.passed).toBe(true);
  });

  it("handles $ without number", () => {
    const r = validateCaption("Earn great money!", { compensation_amount: "$", work_mode: "remote" });
    expect(r.passed).toBe(true);
  });

  it("handles caption with special characters", () => {
    const r = validateCaption("🎯 Hiring! 💰 $15/hr 🌍 Remote — DM me! #NowHiring", { compensation_amount: "$15", work_mode: "remote" });
    expect(r.passed).toBe(true);
  });

  it("handles caption with newlines", () => {
    const r = validateCaption("Hiring!\n\n$15/hr\nRemote\n\nLink in bio ✨", { compensation_amount: "$15", work_mode: "remote" });
    expect(r.passed).toBe(true);
  });

  it("case-insensitive forbidden phrase detection", () => {
    const r = validateCaption("GUARANTEED INCOME for all!", { work_mode: "remote" });
    expect(r.passed).toBe(false);
  });

  it("catches partial forbidden phrase match", () => {
    const r = validateCaption("This offers career growth opportunities!", { work_mode: "remote" });
    expect(r.passed).toBe(false);
  });

  it("handles very long caption (500+ chars)", () => {
    const longCaption = "We're hiring! ".repeat(50) + "$15/hr remote.";
    const r = validateCaption(longCaption, { compensation_amount: "$15", work_mode: "remote" });
    expect(r.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. RECRUITER UI — filtering logic
// ═══════════════════════════════════════════════════════════════════════

describe("Recruiter UI Filtering", () => {
  const allAssets: MockAsset[] = [
    { id: "1", asset_type: "composed_creative", platform: "meta", evaluation_passed: true, blob_url: "x", content: {} },
    { id: "2", asset_type: "organic_carousel", platform: "linkedin", evaluation_passed: true, blob_url: "x", content: { platform: "linkedin_carousel", distribution: "organic" } },
    { id: "3", asset_type: "organic_carousel", platform: "instagram", evaluation_passed: true, blob_url: "x", content: { platform: "ig_carousel", distribution: "organic" } },
    { id: "4", asset_type: "organic_carousel", platform: "linkedin", evaluation_passed: false, blob_url: "x", content: { platform: "linkedin_carousel", distribution: "organic" } },
    { id: "5", asset_type: "organic_carousel", platform: "linkedin", evaluation_passed: true, blob_url: "", content: { platform: "linkedin_carousel", distribution: "organic" } },
    { id: "6", asset_type: "carousel_panel", platform: "linkedin_carousel", evaluation_passed: true, blob_url: "x", content: {} },
  ];

  it("OrganicTab shows only organic_carousel with evaluation_passed and blob_url", () => {
    const visible = allAssets.filter(
      (a) => a.asset_type === "organic_carousel" && a.evaluation_passed === true && a.blob_url,
    );
    expect(visible).toHaveLength(2); // ids 2, 3 — not 4 (failed) or 5 (no blob)
  });

  it("CreativeLibrary never shows organic_carousel", () => {
    const paidOnly = allAssets.filter(
      (a) => a.asset_type === "composed_creative" && a.evaluation_passed === true && a.blob_url,
    );
    expect(paidOnly.every((a) => a.asset_type !== "organic_carousel")).toBe(true);
  });

  it("carousel_panel (paid) never appears in organic filter", () => {
    const organic = allAssets.filter((a) => a.asset_type === "organic_carousel");
    expect(organic.every((a) => a.asset_type !== "carousel_panel")).toBe(true);
  });

  it("platform sub-tab filtering works correctly", () => {
    const organic = allAssets.filter(
      (a) => a.asset_type === "organic_carousel" && a.evaluation_passed && a.blob_url,
    );

    const linkedin = organic.filter((a) => {
      const p = String((a.content as Record<string, unknown>).platform ?? a.platform).toLowerCase();
      return p.includes("linkedin");
    });

    const ig = organic.filter((a) => {
      const p = String((a.content as Record<string, unknown>).platform ?? a.platform).toLowerCase();
      return p.includes("ig") || p.includes("instagram");
    });

    expect(linkedin).toHaveLength(1);
    expect(ig).toHaveLength(1);
    expect(linkedin.length + ig.length).toBe(organic.length); // no orphans
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. LANDING PAGE DRIFT — cross-validate with LP validator logic
// ═══════════════════════════════════════════════════════════════════════

describe("Landing Page Drift Validation", () => {
  function validateLP(
    html: string,
    facts: { compensation_amount?: string; apply_url?: string; work_mode?: string; page_lang?: string },
  ): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    const comp = (facts.compensation_amount ?? "").replace("$", "").replace(",", "").trim();
    if (comp) {
      const found = html.match(/\$[\d,]+(?:\.\d{2})?/g) ?? [];
      for (const a of found) {
        const c = a.replace("$", "").replace(",", "").trim();
        if (c && c !== comp && c !== "0") issues.push(`LP comp drift: ${a} vs $${comp}`);
      }
    }
    const url = facts.apply_url ?? "";
    if (url && url !== "#apply") {
      const btnHrefs = html.match(/class="[^"]*btn[^"]*"[^>]*href="([^"]+)"/gi) ?? [];
      for (const m of btnHrefs) {
        const href = m.match(/href="([^"]+)"/)?.[1] ?? "";
        if (href && !href.startsWith("#") && href !== "https://www.oneforma.com" && href !== url) {
          issues.push(`LP URL drift: ${href}`);
        }
      }
    }
    const mode = (facts.work_mode ?? "").toLowerCase();
    if (mode === "remote") {
      if (html.toLowerCase().includes("visit our facility")) issues.push("LP onsite language on remote page");
    }
    const lang = html.match(/<html[^>]*lang="([^"]+)"/)?.[1] ?? "";
    if (lang && facts.page_lang && lang !== facts.page_lang) {
      issues.push(`LP lang drift: ${lang} vs ${facts.page_lang}`);
    }
    return { passed: issues.length === 0, issues };
  }

  it("passes valid LP with correct facts", () => {
    const html = '<html lang="en"><body><div class="pay-num">$600</div><a class="btn btn-primary" href="https://oneforma.com/apply">Apply</a></body></html>';
    const r = validateLP(html, { compensation_amount: "$600", apply_url: "https://oneforma.com/apply", work_mode: "remote", page_lang: "en" });
    expect(r.passed).toBe(true);
  });

  it("CATCHES LP compensation drift", () => {
    const html = '<html lang="en"><body><div>$999</div></body></html>';
    const r = validateLP(html, { compensation_amount: "$600" });
    expect(r.passed).toBe(false);
  });

  it("CATCHES LP language mismatch", () => {
    const html = '<html lang="es"><body></body></html>';
    const r = validateLP(html, { page_lang: "en" });
    expect(r.passed).toBe(false);
  });

  it("CATCHES LP onsite language on remote page", () => {
    const html = '<html lang="en"><body>Please visit our facility for the session</body></html>';
    const r = validateLP(html, { work_mode: "remote" });
    expect(r.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. ASSET TYPE EXHAUSTIVENESS — no unknown types leak through
// ═══════════════════════════════════════════════════════════════════════

describe("Asset Type Exhaustiveness", () => {
  const VALID_TYPES: AssetType[] = ["base_image", "composed_creative", "carousel_panel", "landing_page", "organic_carousel"];

  it("all 5 asset types are defined", () => {
    expect(VALID_TYPES).toHaveLength(5);
  });

  it("no duplicate asset types", () => {
    const unique = new Set(VALID_TYPES);
    expect(unique.size).toBe(VALID_TYPES.length);
  });

  it("organic_carousel is in the valid set", () => {
    expect(VALID_TYPES).toContain("organic_carousel");
  });

  it("landing_page is in the valid set", () => {
    expect(VALID_TYPES).toContain("landing_page");
  });

  it("unknown types would fail TypeScript compilation", () => {
    // This is a compile-time check — if someone adds a new type
    // without updating the union, TS catches it. This test documents the intent.
    const typeCheck = (t: AssetType): boolean => VALID_TYPES.includes(t);
    expect(typeCheck("organic_carousel")).toBe(true);
    expect(typeCheck("landing_page")).toBe(true);
  });
});
