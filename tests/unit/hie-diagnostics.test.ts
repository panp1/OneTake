import { describe, it, expect, vi, beforeEach } from 'vitest';

let queryResults: unknown[][] = [];
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => {
    return async () => queryResults.shift() ?? [];
  }),
}));

import { runDiagnostics } from '@/lib/hie/diagnostics';
import type { DiagnosticObservation } from '@/lib/hie/diagnostics';

const TEST_URL = 'https://example.com/landing';

describe('runDiagnostics', () => {
  beforeEach(() => {
    queryResults = [];
  });

  it('returns empty observations when all queries return no data', async () => {
    queryResults = [[], [], [], []]; // milestones, ctaEvents, formEvents, deviceSessions
    const result = await runDiagnostics(TEST_URL);
    expect(result).toEqual([]);
  });

  it('detects scroll cliff when >30% drop between consecutive milestones', async () => {
    queryResults = [
      // milestones: 50% drop from milestone 50 to 75
      [
        { milestone: 50, sessions: 100 },
        { milestone: 75, sessions: 50 },
      ],
      [], // ctaEvents
      [], // formEvents
      [], // deviceSessions
    ];
    const result = await runDiagnostics(TEST_URL);
    const scrollCliff = result.find((o) => o.type === 'scroll_cliff');
    expect(scrollCliff).toBeDefined();
    expect(scrollCliff!.message).toContain('50%');
    expect(scrollCliff!.detail.drop_pct).toBe(50);
  });

  it('does NOT detect scroll cliff when <30% drop', async () => {
    queryResults = [
      // milestones: 20% drop (under threshold)
      [
        { milestone: 50, sessions: 100 },
        { milestone: 75, sessions: 80 },
      ],
      [], // ctaEvents
      [], // formEvents
      [], // deviceSessions
    ];
    const result = await runDiagnostics(TEST_URL);
    const scrollCliff = result.find((o) => o.type === 'scroll_cliff');
    expect(scrollCliff).toBeUndefined();
  });

  it('sets confidence high when sessions >= 100', async () => {
    queryResults = [
      [
        { milestone: 25, sessions: 100 },
        { milestone: 50, sessions: 40 },
      ],
      [],
      [],
      [],
    ];
    const result = await runDiagnostics(TEST_URL);
    const scrollCliff = result.find((o) => o.type === 'scroll_cliff');
    expect(scrollCliff).toBeDefined();
    expect(scrollCliff!.confidence).toBe('high');
  });

  it('sets confidence medium when sessions 30-99', async () => {
    queryResults = [
      [
        { milestone: 25, sessions: 50 },
        { milestone: 50, sessions: 10 },
      ],
      [],
      [],
      [],
    ];
    const result = await runDiagnostics(TEST_URL);
    const scrollCliff = result.find((o) => o.type === 'scroll_cliff');
    expect(scrollCliff).toBeDefined();
    expect(scrollCliff!.confidence).toBe('medium');
  });

  it('sets confidence low when sessions < 30', async () => {
    queryResults = [
      [
        { milestone: 25, sessions: 20 },
        { milestone: 50, sessions: 5 },
      ],
      [],
      [],
      [],
    ];
    const result = await runDiagnostics(TEST_URL);
    const scrollCliff = result.find((o) => o.type === 'scroll_cliff');
    expect(scrollCliff).toBeDefined();
    expect(scrollCliff!.confidence).toBe('low');
  });

  it('detects CTA weakness when hovers > 10 and clicks = 0', async () => {
    queryResults = [
      [], // milestones
      // ctaEvents
      [
        { element_selector: '.cta-button', element_tag: 'button', clicks: 0, hovers: 25, sessions: 40 },
      ],
      [], // formEvents
      [], // deviceSessions
    ];
    const result = await runDiagnostics(TEST_URL);
    const ctaWeakness = result.find((o) => o.type === 'cta_weakness');
    expect(ctaWeakness).toBeDefined();
    expect(ctaWeakness!.message).toContain('0 clicks');
    expect(ctaWeakness!.detail.hovers).toBe(25);
  });

  it('detects form friction with 100% abandonment (starts > 5, submits = 0)', async () => {
    queryResults = [
      [], // milestones
      [], // ctaEvents
      // formEvents — 100% abandonment
      [{ form_starts: 20, form_submits: 0, sessions: 50 }],
      [], // deviceSessions
    ];
    const result = await runDiagnostics(TEST_URL);
    const formFriction = result.find((o) => o.type === 'form_friction');
    expect(formFriction).toBeDefined();
    expect(formFriction!.message).toContain('100% abandonment');
  });

  it('detects form friction with >70% abandonment rate', async () => {
    queryResults = [
      [], // milestones
      [], // ctaEvents
      // formEvents — 80% abandonment (100 starts, 20 submits)
      [{ form_starts: 100, form_submits: 20, sessions: 50 }],
      [], // deviceSessions
    ];
    const result = await runDiagnostics(TEST_URL);
    const formFriction = result.find((o) => o.type === 'form_friction');
    expect(formFriction).toBeDefined();
    expect(formFriction!.message).toContain('80%');
    expect(formFriction!.detail.abandon_rate).toBe(80);
  });

  it('does NOT detect form friction when abandonment is < 70%', async () => {
    queryResults = [
      [], // milestones
      [], // ctaEvents
      // formEvents — 50% abandonment (100 starts, 50 submits) — below threshold
      [{ form_starts: 100, form_submits: 50, sessions: 50 }],
      [], // deviceSessions
    ];
    const result = await runDiagnostics(TEST_URL);
    const formFriction = result.find((o) => o.type === 'form_friction');
    expect(formFriction).toBeUndefined();
  });

  it('detects platform mismatch when mobile engagement < 40% of desktop', async () => {
    queryResults = [
      [], // milestones
      [], // ctaEvents
      [], // formEvents
      // deviceSessions — mobile: 2 events / 10 sessions = 0.2, desktop: 50 events / 10 sessions = 5.0
      // ratio: 0.2 / 5.0 = 0.04, well below 0.4 threshold
      [
        { device_type: 'mobile', sessions: 10, events: 2 },
        { device_type: 'desktop', sessions: 10, events: 50 },
      ],
    ];
    const result = await runDiagnostics(TEST_URL);
    const mismatch = result.find((o) => o.type === 'platform_mismatch');
    expect(mismatch).toBeDefined();
    expect(mismatch!.message).toContain('Mobile engagement');
  });

  it('every observation has a recommended_action string', async () => {
    queryResults = [
      // Scroll cliff
      [
        { milestone: 25, sessions: 100 },
        { milestone: 50, sessions: 30 },
      ],
      // CTA weakness
      [
        { element_selector: '.cta-button', element_tag: 'button', clicks: 0, hovers: 20, sessions: 40 },
      ],
      // Form friction (100% abandonment)
      [{ form_starts: 30, form_submits: 0, sessions: 50 }],
      // Platform mismatch
      [
        { device_type: 'mobile', sessions: 10, events: 1 },
        { device_type: 'desktop', sessions: 10, events: 50 },
      ],
    ];
    const result = await runDiagnostics(TEST_URL);
    expect(result.length).toBeGreaterThan(0);
    for (const obs of result) {
      expect(obs.recommended_action).toBeDefined();
      expect(typeof obs.recommended_action).toBe('string');
      expect(obs.recommended_action.length).toBeGreaterThan(0);
    }
  });
});
