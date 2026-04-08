import { readFile } from 'node:fs/promises';

/**
 * Verifier for worker/brand/oneforma.py.
 *
 * Scans the brand module for banned patterns (company names, internal research
 * numbers, project codenames, etc.) that must never leak into LLM prompts.
 *
 * Exits 0 if clean, 1 if any banned pattern is found.
 *
 * Run with: node --experimental-strip-types scripts/verify-brand-module.mjs
 */

const BANNED_PATTERNS = [
  // ─── End-customer names ─────────────────────────────────────────────
  ['openai',          /\bopenai\b/i,                                  'end-customer name'],
  ['anthropic',       /\banthropic\b/i,                               'end-customer name'],
  ['google-ai',       /\bgoogle\b[^\n]{0,40}\b(ai|data|training|cloud|deepmind)\b/i, 'end-customer reference'],
  ['meta-ai',         /\bmeta\b[^\n]{0,40}\b(ai|llama)\b/i,           'end-customer reference'],
  ['apple-intel',     /\bapple\s+intelligence\b/i,                    'end-customer name'],
  // ─── Enterprise client names ─────────────────────────────────────────
  ['microsoft',       /\bmicrosoft\b/i,                               'enterprise client name'],
  ['fedex',           /\bfedex\b/i,                                   'enterprise client name'],
  ['lowes',           /\blowe[''']?s\b/i,                             'enterprise client name'],
  ['allstate',        /\ballstate\b/i,                                'enterprise client name'],
  ['sony',            /\bsony\b/i,                                    'enterprise client name'],
  // ─── Competitor names ───────────────────────────────────────────────
  ['surge-ai',        /\bsurge\s+ai\b/i,                              'competitor name'],
  ['mercor',          /\bmercor\b/i,                                  'competitor name'],
  ['outlier',         /\boutlier\b/i,                                 'competitor name'],
  ['scale-ai',        /\bscale\s+ai\b/i,                              'competitor name'],
  ['handshake-ai',    /\bhandshake\s+ai\b/i,                          'competitor name'],
  ['appen',           /\bappen\b/i,                                   'competitor name'],
  ['crowdgen',        /\bcrowdgen\b/i,                                'competitor name'],
  ['prolific',        /\bprolific\b/i,                                'competitor name'],
  ['imerit',          /\bimerit\b/i,                                  'competitor name'],
  ['toloka',          /\btoloka\b/i,                                  'competitor name'],
  ['centaur-labs',    /\bcentaur\s+labs\b/i,                          'competitor name'],
  // ─── Internal people and agencies ───────────────────────────────────
  ['olivine',         /\bolivine\b/i,                                 'internal agency name'],
  ['clayton-p',       /clayton\s+pritchard/i,                         'internal person name'],
  ['teri-m',          /teri\s+madonna/i,                              'internal person name'],
  ['brendan-f',       /brendan\s+flannery/i,                          'internal person name'],
  ['aaron-w',         /aaron\s+wizner/i,                              'internal person name'],
  ['giuseppe-p',      /giuseppe\s+prisco/i,                           'internal person name'],
  ['gaetano-s',       /gaetano\s+schiavone/i,                         'internal person name'],
  ['barbara-f',       /barbara\s+fernandez/i,                         'internal person name'],
  // ─── Internal products and sister brands ────────────────────────────
  ['uhrs',            /\buhrs\b/i,                                    'internal product name'],
  ['data-foundry',    /\bdata\s+foundry\b/i,                          'internal product name'],
  ['tryrating',       /\btryrating\b/i,                               'internal product name'],
  ['otms',            /\botms\b/i,                                    'internal product name'],
  ['atms',            /\batms\b/i,                                    'internal product name'],
  ['centific',        /\bcentific\b/i,                                'internal parent brand'],
  // ─── Internal project codenames ─────────────────────────────────────
  ['cutis',           /\bcutis\b/i,                                   'internal project codename'],
  ['lightspeed',      /\blightspeed\b/i,                              'internal project codename'],
  ['maps-program',    /\bmaps\s+program\b/i,                          'internal project codename'],
  ['milky-way',       /\bmilky\s+way\b/i,                             'internal project codename'],
  ['lumina',          /\blumina\b/i,                                  'internal project codename'],
  ['vega',            /\bvega\b/i,                                    'internal project codename'],
  ['karl-llm',        /\bkarl\s+llm\b/i,                              'internal project codename'],
  ['cherry-opal',     /\bcherry\s+opal\b/i,                           'internal project codename'],
  ['lighthouse',      /\blighthouse\s+\d/i,                           'internal project codename'],
  ['andromeda',       /\bandromeda\b/i,                               'internal project codename'],
  // ─── Internal research numbers ──────────────────────────────────────
  ['revenue-22-5m',   /\$\s?22\.?5\s?M/i,                             'internal financial number'],
  ['revenue-165m',    /\$\s?165\s?M/i,                                'internal financial number'],
  ['survey-n934',     /n\s?=\s?934/i,                                 'internal research number'],
  ['441-mentions',    /441\s+mentions/i,                              'internal research number'],
  ['57-pct-yoy',      /57%\s+YoY/i,                                   'internal growth number'],
  ['42-pct-yoy',      /42%\s+YoY/i,                                   'internal growth number'],
];

const TARGET_FILE = 'worker/brand/oneforma.py';
const content = await readFile(TARGET_FILE, 'utf8');

// Skip patterns that appear ONLY in docstring rule-list (which describes what's banned)
// by scanning line-by-line and skipping lines inside the governance docstring.
const failures = [];
for (const [name, regex, reason] of BANNED_PATTERNS) {
  if (regex.test(content)) {
    failures.push({ name, reason });
  }
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} banned pattern(s) found in ${TARGET_FILE}:`);
  for (const { name, reason } of failures) {
    console.error(`  ❌ ${name} — ${reason}`);
  }
  process.exit(1);
}

console.log(`✓ ${TARGET_FILE} is clean (${BANNED_PATTERNS.length} patterns checked)`);
