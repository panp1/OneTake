# Creative Artifacts Expansion + Task Contextualizer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the design artifact library from 14 to 37 items (badges, patterns, UI cards, gradients, device frames) and build a Task Contextualizer that generates campaign-specific device mockups showing what contributors will actually DO.

**Architecture:** Tasks 1-4 create the new artifact files (SVG, HTML, CSS, PNG). Task 5 updates the seeding script. Task 6 builds the contextualizer pipeline (Playwright render + PIL composite). Task 7 wires it into Stage 4. Task 8 updates VQA.

**Tech Stack:** SVG/HTML/CSS for artifacts, Node.js seeding script (Vercel Blob + Neon), Python 3.13 (Playwright + Pillow) for contextualizer pipeline, existing compositor prompt system.

**Spec:** `docs/superpowers/specs/2026-04-12-creative-artifacts-expansion-design.md`

---

## File Structure

### New Files — Artifacts (20 files)
| File | Type | Category |
|---|---|---|
| `scripts/artifacts/badges/badge_microphone.svg` | SVG | badge |
| `scripts/artifacts/badges/badge_document.svg` | SVG | badge |
| `scripts/artifacts/badges/badge_language.svg` | SVG | badge |
| `scripts/artifacts/badges/badge_clipboard.svg` | SVG | badge |
| `scripts/artifacts/badges/badge_camera.svg` | SVG | badge |
| `scripts/artifacts/badges/badge_stethoscope.svg` | SVG | badge |
| `scripts/artifacts/badges/badge_headphones.svg` | SVG | badge |
| `scripts/artifacts/badges/badge_chart.svg` | SVG | badge |
| `scripts/artifacts/badges/badge_dollar.svg` | SVG | badge |
| `scripts/artifacts/badges/badge_shield.svg` | SVG | badge |
| `scripts/artifacts/patterns/pattern_dot_grid.svg` | SVG | pattern |
| `scripts/artifacts/patterns/pattern_diagonal_lines.svg` | SVG | pattern |
| `scripts/artifacts/patterns/pattern_concentric_circles.svg` | SVG | pattern |
| `scripts/artifacts/cards/card_notification.html` | HTML | card |
| `scripts/artifacts/cards/card_earnings.html` | HTML | card |
| `scripts/artifacts/cards/card_task_preview.html` | HTML | card |
| `scripts/artifacts/cards/card_testimonial.html` | HTML | card |
| `scripts/artifacts/gradients/gradient_bowl_curve.css` | CSS | gradient |
| `scripts/artifacts/gradients/gradient_diagonal_sweep.css` | CSS | gradient |
| `scripts/artifacts/gradients/gradient_radial_burst.css` | CSS | gradient |

### New Files — Task Contextualizer
| File | Type |
|---|---|
| `scripts/artifacts/task-previews/annotation_preview.html` | HTML template |
| `scripts/artifacts/task-previews/data_collection_preview.html` | HTML template |
| `scripts/artifacts/task-previews/judging_preview.html` | HTML template |
| `scripts/artifacts/task-previews/transcription_preview.html` | HTML template |
| `scripts/artifacts/task-previews/translation_preview.html` | HTML template |
| `scripts/artifacts/devices/device_phone_portrait.svg` | SVG frame |
| `worker/pipeline/stage4_contextualizer.py` | Python pipeline |

### Modified Files
| File | Changes |
|---|---|
| `scripts/seed-design-artifacts.mjs` | Add 23 new artifact entries |
| `worker/pipeline/stage4_compose_v3.py` | Call contextualizer, pass device_mockup_url |
| `worker/prompts/compositor_prompt.py` | Add task contextualizer section |
| `worker/ai/creative_vqa.py` | Add task context scoring dimension |

---

## Task 1: Create Badge SVGs (10 files)

**Files:**
- Create: `scripts/artifacts/badges/badge_microphone.svg` (and 9 more)

- [ ] **Step 1: Create all 10 badge SVGs**

Each badge is 96×96px with: gradient circle background (brand purple-pink at 15% opacity), white Lucide-style icon, subtle drop shadow.

Create `scripts/artifacts/badges/badge_microphone.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#E91E8C" stop-opacity="0.08"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08"/></filter>
  </defs>
  <circle cx="48" cy="48" r="44" fill="url(#bg)" filter="url(#shadow)"/>
  <g transform="translate(28,28)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 1a4 4 0 0 0-4 4v12a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z"/>
    <path d="M28 15v3a8 8 0 0 1-16 0v-3"/>
    <line x1="20" y1="26" x2="20" y2="32"/>
    <line x1="14" y1="32" x2="26" y2="32"/>
  </g>
</svg>
```

Repeat for each badge, changing only the icon `<g>` path data. Each uses the same gradient circle + shadow template. Icon paths from Lucide (scaled to 40×40 within a 96×96 circle):

- `badge_document`: FileText icon
- `badge_language`: Languages icon (two A characters)
- `badge_clipboard`: ClipboardCheck icon
- `badge_camera`: Camera icon
- `badge_stethoscope`: custom medical stethoscope path
- `badge_headphones`: Headphones icon
- `badge_chart`: BarChart3 icon
- `badge_dollar`: DollarSign icon
- `badge_shield`: Shield icon

- [ ] **Step 2: Verify all SVGs render**

```bash
ls -la scripts/artifacts/badges/badge_*.svg | wc -l
# Expected: 13 (3 existing + 10 new)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/artifacts/badges/
git commit -m "feat(artifacts): add 10 task-specific gradient-backed badge SVGs (96px)"
```

---

## Task 2: Create Patterns + Gradients (6 files)

**Files:**
- Create: `scripts/artifacts/patterns/pattern_dot_grid.svg`
- Create: `scripts/artifacts/patterns/pattern_diagonal_lines.svg`
- Create: `scripts/artifacts/patterns/pattern_concentric_circles.svg`
- Create: `scripts/artifacts/gradients/gradient_bowl_curve.css`
- Create: `scripts/artifacts/gradients/gradient_diagonal_sweep.css`
- Create: `scripts/artifacts/gradients/gradient_radial_burst.css`

- [ ] **Step 1: Create 3 pattern SVGs**

`scripts/artifacts/patterns/pattern_dot_grid.svg` (200×200 tileable):
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs><pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
    <circle cx="2" cy="2" r="1.5" fill="#6B21A8" opacity="0.08"/>
  </pattern></defs>
  <rect width="200" height="200" fill="url(#dots)"/>
</svg>
```

`scripts/artifacts/patterns/pattern_diagonal_lines.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <defs><pattern id="lines" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="12" stroke="#6B21A8" stroke-width="1.5" opacity="0.05"/>
  </pattern></defs>
  <rect width="200" height="200" fill="url(#lines)"/>
</svg>
```

`scripts/artifacts/patterns/pattern_concentric_circles.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <circle cx="0" cy="0" r="40" fill="none" stroke="#6B21A8" stroke-width="1" opacity="0.06"/>
  <circle cx="0" cy="0" r="80" fill="none" stroke="#6B21A8" stroke-width="1" opacity="0.04"/>
  <circle cx="0" cy="0" r="120" fill="none" stroke="#6B21A8" stroke-width="0.8" opacity="0.03"/>
  <circle cx="0" cy="0" r="160" fill="none" stroke="#6B21A8" stroke-width="0.6" opacity="0.02"/>
</svg>
```

- [ ] **Step 2: Create 3 gradient CSS files**

`scripts/artifacts/gradients/gradient_bowl_curve.css`:
```css
/* Bowl curve: SVG clip-path creating a curved divider at 55% from top.
   Person sits in the gradient bowl, headline above. */
.gradient-bowl-curve {
  position: relative;
  background: linear-gradient(135deg, #3D1059 0%, #6B21A8 50%, #E91E8C 100%);
  clip-path: ellipse(80% 55% at 50% 45%);
}
```

`scripts/artifacts/gradients/gradient_diagonal_sweep.css`:
```css
/* Diagonal sweep: 45° gradient from bottom-left fading to white top-right.
   Editorial/modern feel. Person on the white side. */
.gradient-diagonal-sweep {
  background: linear-gradient(135deg, #3D1059 0%, #6B21A8 35%, #f8f5ff 65%, #ffffff 100%);
}
```

`scripts/artifacts/gradients/gradient_radial_burst.css`:
```css
/* Radial burst: Spotlight from center fading to white at edges.
   Draws eye to the person at center. */
.gradient-radial-burst {
  background: radial-gradient(ellipse at 50% 45%, #6B21A8 0%, #3D1059 30%, #f8f5ff 70%, #ffffff 100%);
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/artifacts/patterns/ scripts/artifacts/gradients/
git commit -m "feat(artifacts): add 3 pattern textures + 3 gradient application styles"
```

---

## Task 3: Create UI Card HTML Snippets (4 files)

**Files:**
- Create: `scripts/artifacts/cards/card_notification.html`
- Create: `scripts/artifacts/cards/card_earnings.html`
- Create: `scripts/artifacts/cards/card_task_preview.html`
- Create: `scripts/artifacts/cards/card_testimonial.html`

- [ ] **Step 1: Create cards directory and 4 HTML files**

```bash
mkdir -p scripts/artifacts/cards
```

`scripts/artifacts/cards/card_notification.html`:
```html
<div style="width:200px;background:white;border-radius:12px;padding:12px 14px;box-shadow:0 4px 16px rgba(0,0,0,0.1);font-family:system-ui;display:flex;align-items:center;gap:10px;">
  <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6B21A8,#E91E8C);display:flex;align-items:center;justify-content:center;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
  </div>
  <div style="flex:1;min-width:0;">
    <div style="font-size:11px;font-weight:700;color:#1a1a1a;">New task available</div>
    <div style="font-size:9px;color:#888;margin-top:1px;">Review 5 items · Est. 12 min</div>
  </div>
  <div style="font-size:8px;color:#aaa;">2m ago</div>
</div>
```

`scripts/artifacts/cards/card_earnings.html`:
```html
<div style="width:200px;background:white;border-radius:12px;padding:14px;box-shadow:0 4px 16px rgba(0,0,0,0.1);font-family:system-ui;">
  <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">This Week</div>
  <div style="font-size:22px;font-weight:800;color:#1a1a1a;margin:4px 0;">$247.50</div>
  <div style="height:6px;background:#f0f0f0;border-radius:3px;overflow:hidden;margin:8px 0;">
    <div style="width:72%;height:100%;background:linear-gradient(90deg,#6B21A8,#E91E8C);border-radius:3px;"></div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:9px;color:#888;">
    <span>18 tasks completed</span>
    <span style="color:#6B21A8;font-weight:600;">View Details</span>
  </div>
</div>
```

`scripts/artifacts/cards/card_task_preview.html`:
```html
<div style="width:200px;background:white;border-radius:12px;padding:14px;box-shadow:0 4px 16px rgba(0,0,0,0.1);font-family:system-ui;">
  <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
    <div style="width:8px;height:8px;border-radius:50%;background:#22c55e;"></div>
    <span style="font-size:10px;font-weight:600;color:#1a1a1a;">Available Now</span>
  </div>
  <div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-bottom:4px;">{task_title}</div>
  <div style="display:flex;gap:6px;margin-bottom:8px;">
    <span style="font-size:9px;padding:2px 6px;border-radius:4px;background:#f0f0f0;color:#666;">~15 min</span>
    <span style="font-size:9px;padding:2px 6px;border-radius:4px;background:#f0f0f0;color:#666;">$12.50</span>
  </div>
  <div style="background:linear-gradient(135deg,#6B21A8,#E91E8C);color:white;text-align:center;padding:6px;border-radius:8px;font-size:10px;font-weight:700;">Start Task</div>
</div>
```

`scripts/artifacts/cards/card_testimonial.html`:
```html
<div style="width:220px;background:white;border-radius:12px;padding:14px;box-shadow:0 4px 16px rgba(0,0,0,0.1);font-family:system-ui;">
  <div style="font-size:28px;color:#6B21A8;opacity:0.15;line-height:1;margin-bottom:4px;">"</div>
  <div style="font-size:11px;color:#444;line-height:1.5;font-style:italic;margin-bottom:10px;">The flexibility is incredible. I work between classes and earned enough for my semester books.</div>
  <div style="display:flex;align-items:center;gap:8px;">
    <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6B21A8,#E91E8C);"></div>
    <div>
      <div style="font-size:10px;font-weight:700;color:#1a1a1a;">Sarah M.</div>
      <div style="font-size:8px;color:#888;">Verified Contributor · 6 months</div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add scripts/artifacts/cards/
git commit -m "feat(artifacts): add 4 floating UI card HTML snippets (notification, earnings, task, testimonial)"
```

---

## Task 4: Create Task Preview Templates + Device Frame (6 files)

**Files:**
- Create: `scripts/artifacts/task-previews/` (5 HTML templates)
- Create: `scripts/artifacts/devices/device_phone_portrait.svg`

- [ ] **Step 1: Create task preview directory and 5 templates**

```bash
mkdir -p scripts/artifacts/task-previews scripts/artifacts/devices
```

Each template is a self-contained HTML page at phone screen dimensions (240×480px) with a dark/light OneForma UI showing the task interface. Templates use `{placeholder}` variables.

Create `scripts/artifacts/task-previews/annotation_preview.html`:
```html
<div style="width:240px;height:480px;background:#fafafa;font-family:-apple-system,system-ui,sans-serif;overflow:hidden;border-radius:8px;">
  <div style="height:24px;background:#1a1a2e;display:flex;align-items:center;justify-content:space-between;padding:0 12px;">
    <span style="color:#888;font-size:8px;">9:41</span>
    <span style="color:#888;font-size:8px;">●●●</span>
  </div>
  <div style="padding:10px;background:#1e1e3a;display:flex;align-items:center;gap:6px;">
    <div style="width:18px;height:18px;border-radius:4px;background:linear-gradient(135deg,#6B21A8,#E91E8C);"></div>
    <span style="color:white;font-size:10px;font-weight:600;">OneForma</span>
    <span style="color:#6B21A8;font-size:8px;margin-left:auto;">47/200</span>
  </div>
  <div style="padding:10px;">
    <div style="background:white;border-radius:8px;padding:10px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="font-size:10px;font-weight:600;color:#1a1a1a;margin-bottom:3px;">{task_title}</div>
      <div style="font-size:8px;color:#888;line-height:1.4;">{sample_content}</div>
    </div>
    <div style="display:flex;gap:6px;">
      <div style="flex:1;background:#22c55e;color:white;text-align:center;padding:7px;border-radius:6px;font-size:9px;font-weight:600;">Approve</div>
      <div style="flex:1;background:#ef4444;color:white;text-align:center;padding:7px;border-radius:6px;font-size:9px;font-weight:600;">Reject</div>
    </div>
    <div style="background:white;border-radius:8px;padding:10px;margin-top:8px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <div style="font-size:9px;color:#888;margin-bottom:6px;">Labels</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        <span style="font-size:8px;padding:3px 8px;border-radius:4px;background:#f0f0f0;color:#666;">Relevant</span>
        <span style="font-size:8px;padding:3px 8px;border-radius:4px;background:#dcfce7;color:#15803d;">Selected</span>
        <span style="font-size:8px;padding:3px 8px;border-radius:4px;background:#f0f0f0;color:#666;">Spam</span>
        <span style="font-size:8px;padding:3px 8px;border-radius:4px;background:#f0f0f0;color:#666;">Other</span>
      </div>
    </div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;height:36px;background:#1a1a2e;display:flex;align-items:center;justify-content:space-around;">
    <span style="color:#6B21A8;font-size:8px;font-weight:600;">Tasks</span>
    <span style="color:#555;font-size:8px;">Earnings</span>
    <span style="color:#555;font-size:8px;">Profile</span>
  </div>
</div>
```

Create similar templates for the other 4 task types, each with task-specific UI elements:

- `data_collection_preview.html` — Camera viewfinder / photo upload zone / data fields / "Capture" button
- `judging_preview.html` — "Which is better?" prompt / side-by-side images / star rating / thumbs up-down
- `transcription_preview.html` — Audio waveform (CSS bars) / play button / text area / timestamp markers
- `translation_preview.html` — Two-column split / source text left / translation field right / language flags / char counter

- [ ] **Step 2: Create device frame SVG**

`scripts/artifacts/devices/device_phone_portrait.svg` — iPhone-style frame (280×560) with transparent screen area:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="560" viewBox="0 0 280 560">
  <defs>
    <filter id="phone-shadow">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-opacity="0.15"/>
    </filter>
  </defs>
  <!-- Phone body -->
  <rect x="0" y="0" width="280" height="560" rx="36" ry="36" fill="#1a1a1a" filter="url(#phone-shadow)"/>
  <!-- Screen bezel -->
  <rect x="8" y="8" width="264" height="544" rx="28" ry="28" fill="#2a2a2a"/>
  <!-- Screen area (transparent — screenshot composites here) -->
  <rect x="12" y="40" width="256" height="480" rx="4" ry="4" fill="transparent" id="screen"/>
  <!-- Notch -->
  <rect x="90" y="8" width="100" height="24" rx="12" ry="12" fill="#1a1a1a"/>
  <!-- Home indicator -->
  <rect x="100" y="540" width="80" height="4" rx="2" ry="2" fill="#555"/>
</svg>
```

- [ ] **Step 3: Commit**

```bash
git add scripts/artifacts/task-previews/ scripts/artifacts/devices/
git commit -m "feat(artifacts): add 5 task preview templates + phone device frame SVG"
```

---

## Task 5: Update Seeding Script

**Files:**
- Modify: `scripts/seed-design-artifacts.mjs`

- [ ] **Step 1: Read the current seeding script**

Read `scripts/seed-design-artifacts.mjs` in full.

- [ ] **Step 2: Add 23 new artifact entries to the ARTIFACTS array**

Find the existing `ARTIFACTS` array and append entries for all new artifacts. Each entry follows the existing pattern with `artifact_id`, `category`, `description`, `file_path`, `dimensions`, `css_class`, `usage_notes`, `pillar_affinity`, `format_affinity`.

New entries to add (showing pattern — the subagent must create all 23):

```javascript
// ── NEW BADGES ──
{ artifact_id: "badge_microphone", category: "badge", description: "Microphone icon for transcription tasks", file_path: "badges/badge_microphone.svg", dimensions: "96x96", css_class: "badge-icon", usage_notes: "Floating badge for transcription campaigns", pillar_affinity: ["earn", "grow"], format_affinity: ["ig_feed", "facebook_feed", "linkedin_feed"] },
// ... 9 more badges

// ── PATTERNS ──
{ artifact_id: "pattern_dot_grid", category: "pattern", description: "Subtle dot grid texture (tileable)", file_path: "patterns/pattern_dot_grid.svg", dimensions: "200x200", css_class: "pattern-tile", usage_notes: "Use as corner texture — background-repeat:repeat, opacity:0.08", pillar_affinity: ["earn", "grow", "shape"], format_affinity: ["ig_feed", "facebook_feed", "linkedin_feed", "ig_story", "tiktok_feed"] },
// ... 2 more patterns

// ── UI CARDS ──
{ artifact_id: "card_notification", category: "card", description: "Push notification card — 'New task available'", file_path: "cards/card_notification.html", dimensions: "200x60", css_class: "floating-card", usage_notes: "Position as floating element with box-shadow", pillar_affinity: ["earn", "grow"], format_affinity: ["ig_feed", "facebook_feed", "linkedin_feed"] },
// ... 3 more cards

// ── GRADIENT APPLICATIONS ──
{ artifact_id: "gradient_bowl_curve", category: "gradient", description: "Bowl curve gradient with clip-path divider at 55%", file_path: "gradients/gradient_bowl_curve.css", dimensions: "CSS", css_class: "gradient-bowl", usage_notes: "Person sits in bowl, headline above divider", pillar_affinity: ["earn", "grow", "shape"], format_affinity: ["ig_feed", "facebook_feed", "linkedin_feed"] },
// ... 2 more gradients
```

Also update the `buildUsageSnippet()` function to handle the new categories:
```javascript
case "card":
  return `<div style="position:absolute;">${readFileSync(join(ARTIFACTS_DIR, entry.file_path), "utf-8")}</div>`;
case "pattern":
  return `<div style="position:absolute;width:100%;height:100%;background-image:url('${blobUrl}');background-repeat:repeat;opacity:0.08;"></div>`;
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-design-artifacts.mjs
git commit -m "feat(artifacts): add 23 new artifacts to seeding script — badges, patterns, cards, gradients"
```

---

## Task 6: Task Contextualizer Pipeline

**Files:**
- Create: `worker/pipeline/stage4_contextualizer.py`

- [ ] **Step 1: Create the contextualizer module**

```python
"""Stage 4 Phase 0: Task Contextualizer.

Generates a device mockup PNG showing what the contributor's task looks like.
This mockup is composited into creatives by GLM-5 for maximum context.

Flow:
  1. Load task preview HTML template for the campaign's task_type
  2. Fill placeholders from brief + form_data
  3. Render to PNG via Playwright (phone screen dimensions)
  4. Composite into device frame (phone SVG → PNG)
  5. Upload to Vercel Blob
  6. Return blob_url for use as composition artifact
"""
from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Task preview templates directory
PREVIEW_TEMPLATES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "scripts", "artifacts", "task-previews",
)

# Template file mapping
TASK_TYPE_TEMPLATES: dict[str, str] = {
    "annotation": "annotation_preview.html",
    "audio_annotation": "annotation_preview.html",
    "image_annotation": "annotation_preview.html",
    "text_labeling": "annotation_preview.html",
    "data_collection": "data_collection_preview.html",
    "judging": "judging_preview.html",
    "transcription": "transcription_preview.html",
    "translation": "translation_preview.html",
}

# Screen dimensions for rendering (matches device frame screen area)
SCREEN_WIDTH = 256
SCREEN_HEIGHT = 480


def _load_template(task_type: str) -> str | None:
    """Load the HTML template for a task type."""
    template_name = TASK_TYPE_TEMPLATES.get(task_type)
    if not template_name:
        logger.info("No task preview template for type '%s'", task_type)
        return None

    template_path = os.path.join(PREVIEW_TEMPLATES_DIR, template_name)
    if not os.path.exists(template_path):
        logger.warning("Template file not found: %s", template_path)
        return None

    with open(template_path, "r") as f:
        return f.read()


def _fill_template(html: str, brief: dict, form_data: dict) -> str:
    """Replace placeholders in template with campaign-specific content."""
    title = brief.get("title", form_data.get("title", "Review Task"))
    task_desc = form_data.get("task_description", "")
    comp_rate = form_data.get("compensation_rate", "12.50")

    # Build sample content from brief context
    sample = task_desc[:80] if task_desc else "Review and classify the content below"

    replacements = {
        "{task_title}": str(title)[:40],
        "{task_description}": str(task_desc)[:100],
        "{sample_content}": sample,
        "{progress_count}": "47 of 200",
        "{earnings_amount}": f"${comp_rate}",
        "{language}": ", ".join(brief.get("target_languages", ["English"])[:2]),
    }

    for key, value in replacements.items():
        html = html.replace(key, value)

    return html


async def generate_task_contextualizer(
    task_type: str,
    brief: dict[str, Any],
    form_data: dict[str, Any],
) -> str | None:
    """Generate a device mockup PNG with campaign-specific task screenshot.

    Returns blob_url of the composed device mockup, or None on failure.
    """
    from ai.compositor import render_to_png
    from blob_uploader import upload_to_blob

    # 1. Load template
    template = _load_template(task_type)
    if not template:
        return None

    # 2. Fill with campaign data
    filled_html = _fill_template(template, brief, form_data)

    # 3. Wrap in a full HTML page for rendering
    full_html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ background: transparent; }}
</style></head><body>{filled_html}</body></html>"""

    try:
        # 4. Render to PNG at screen dimensions
        screenshot = await render_to_png(full_html, SCREEN_WIDTH, SCREEN_HEIGHT)

        # 5. Composite into device frame using PIL
        device_png = _composite_into_device(screenshot)
        if not device_png:
            # Fallback: just use the raw screenshot
            device_png = screenshot

        # 6. Upload to Blob
        uid = os.urandom(4).hex()
        filename = f"device_mockup_{task_type}_{uid}.png"
        blob_url = await upload_to_blob(
            device_png, filename,
            folder="task-contextualizers",
            content_type="image/png",
        )

        logger.info(
            "Task contextualizer generated: type=%s, size=%dKB, url=%s",
            task_type, len(device_png) // 1024, blob_url[:60],
        )
        return blob_url

    except Exception as e:
        logger.error("Task contextualizer failed: %s", e)
        return None


def _composite_into_device(screenshot_png: bytes) -> bytes | None:
    """Composite a screenshot PNG into the phone device frame.

    Uses Pillow to paste the screenshot into the transparent screen area
    of the device frame SVG (pre-rendered to PNG).
    """
    try:
        from PIL import Image
        import io

        # Load screenshot
        screenshot = Image.open(io.BytesIO(screenshot_png)).convert("RGBA")

        # Create device frame (simple approach: dark rounded rect + screenshot)
        # Device dimensions: 280x560, screen at offset (12, 40) size (256, 480)
        device = Image.new("RGBA", (280, 560), (0, 0, 0, 0))

        # Draw phone body (dark rounded rectangle)
        from PIL import ImageDraw
        body = Image.new("RGBA", (280, 560), (0, 0, 0, 0))
        draw = ImageDraw.Draw(body)
        draw.rounded_rectangle([0, 0, 279, 559], radius=36, fill=(26, 26, 26, 255))

        # Draw screen bezel
        draw.rounded_rectangle([8, 8, 271, 551], radius=28, fill=(42, 42, 42, 255))

        # Draw notch
        draw.rounded_rectangle([90, 8, 189, 32], radius=12, fill=(26, 26, 26, 255))

        # Draw home indicator
        draw.rounded_rectangle([100, 540, 179, 544], radius=2, fill=(85, 85, 85, 255))

        device = body

        # Resize screenshot to fit screen area
        screenshot_resized = screenshot.resize((256, 480), Image.LANCZOS)

        # Paste screenshot into screen area
        device.paste(screenshot_resized, (12, 40))

        # Export
        buf = io.BytesIO()
        device.save(buf, format="PNG")
        return buf.getvalue()

    except ImportError:
        logger.warning("Pillow not installed — returning raw screenshot")
        return None
    except Exception as e:
        logger.warning("Device frame composition failed: %s — returning raw screenshot", e)
        return None
```

- [ ] **Step 2: Verify Python syntax**

Run: `python3 -c "import ast; ast.parse(open('worker/pipeline/stage4_contextualizer.py').read()); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add worker/pipeline/stage4_contextualizer.py
git commit -m "feat(pipeline): add task contextualizer — generates device mockup with campaign-specific task UI"
```

---

## Task 7: Wire Contextualizer into Stage 4

**Files:**
- Modify: `worker/pipeline/stage4_compose_v3.py`
- Modify: `worker/prompts/compositor_prompt.py`

- [ ] **Step 1: Add contextualizer call in run_stage4()**

In `worker/pipeline/stage4_compose_v3.py`, add import at top:
```python
from pipeline.stage4_contextualizer import generate_task_contextualizer
```

In `run_stage4()`, BEFORE the composition matrix dispatch (after loading artifacts and copy), add:
```python
    # ── Generate task contextualizer (once per campaign) ──────────
    task_type = context.get("task_type", brief.get("task_type", ""))
    form_data = context.get("form_data", {})
    device_mockup_url = await generate_task_contextualizer(
        task_type=task_type,
        brief=brief,
        form_data=form_data,
    )
    if device_mockup_url:
        logger.info("Task contextualizer ready: %s", device_mockup_url[:60])
```

Pass `device_mockup_url` to each `_compose_one()` call in the tasks list:
```python
    tasks = [
        _compose_one(
            ...existing params...,
            device_mockup_url=device_mockup_url,  # NEW
        )
        for item in matrix
    ]
```

Update `_compose_one()` signature to accept `device_mockup_url: str | None = None`.

Inside `_compose_one()`, add `device_mockup_url` to the actor dict before passing to compositor:
```python
        if device_mockup_url:
            composition_actor["device_mockup_url"] = device_mockup_url
```

- [ ] **Step 2: Add contextualizer section to compositor prompt**

In `worker/prompts/compositor_prompt.py`, in `_section_inputs()`, add after the text overlay rule block:

```python
    # Task contextualizer device mockup
    device_block = ""
    device_url = actor.get("device_mockup_url", "")
    if device_url:
        device_block = f"""

TASK CONTEXTUALIZER (floating device showing what contributors DO — HIGH IMPACT):
  Device mockup URL: {device_url}
  This is a phone mockup showing the actual task interface.
  Layer it alongside or overlapping the actor photo:
  - Floating to the left or right of the actor
  - Slightly rotated (2-5° tilt for natural feel)
  - 30-40% of canvas width
  - Subtle drop shadow (0 8px 24px rgba(0,0,0,0.15))
  - Can overlap the actor slightly for depth
  Usage: <img src="{device_url}" style="position:absolute; ... " />
  This element is OPTIONAL — skip if layout is too cramped.
  But when used, it dramatically increases perceived quality."""
```

Append `device_block` to the return string.

- [ ] **Step 3: Verify Python syntax**

```bash
python3 -c "import ast; ast.parse(open('worker/pipeline/stage4_compose_v3.py').read()); print('OK')"
python3 -c "import ast; ast.parse(open('worker/prompts/compositor_prompt.py').read()); print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add worker/pipeline/stage4_compose_v3.py worker/prompts/compositor_prompt.py
git commit -m "feat(pipeline): wire task contextualizer into Stage 4 — device mockup passed to GLM-5 compositor"
```

---

## Task 8: VQA Task Context Scoring

**Files:**
- Modify: `worker/ai/creative_vqa.py`

- [ ] **Step 1: Add task context dimension to VLM prompt**

In `worker/ai/creative_vqa.py`, find the `CREATIVE_VQA_PROMPT` string. After the existing `7. PERSON VISIBILITY` dimension, add:

```
8. TASK CONTEXT (0-1): Does the creative show what the contributor will actually DO? Look for a device mockup (phone/tablet showing a UI), a floating task card, or visual element that answers "what's the task?" Device mockup present and well-positioned = 0.9+. Task card or contextual element = 0.7+. No task context element at all = cap at 0.5.
```

Update the JSON schema to include `"task_context": 0.0`.

Update the weighted average formula:
```
CTR_APPEAL (20%) + PERSON_VISIBILITY (20%) + TASK_CONTEXT (15%) + DEPTH (15%) + COMPOSITION (15%) + BRAND (10%) + HEADLINE_MATCH (5%)
```

- [ ] **Step 2: Verify Python syntax**

```bash
python3 -c "import ast; ast.parse(open('worker/ai/creative_vqa.py').read()); print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add worker/ai/creative_vqa.py
git commit -m "feat(pipeline): add task context scoring to VQA — device mockup presence rewards quality score"
```
