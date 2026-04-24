import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSql = vi.fn(async () => []);
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => mockSql),
}));

import { registerSession, ingestBatch } from '@/lib/hie/ingest';
import type { HieSessionData, HieEvent } from '@/lib/hie/ingest';

describe('registerSession', () => {
  beforeEach(() => {
    mockSql.mockClear();
    mockSql.mockResolvedValue([]);
  });

  it('returns false for missing session_id', async () => {
    const data = { session_id: '', visitor_id: 'v_abc123' } as HieSessionData;
    const result = await registerSession(data);
    expect(result).toBe(false);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('returns false for missing visitor_id', async () => {
    const data = { session_id: 'hs_abc123', visitor_id: '' } as HieSessionData;
    const result = await registerSession(data);
    expect(result).toBe(false);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('returns true for valid data and calls DB', async () => {
    const data: HieSessionData = {
      session_id: 'hs_abc123',
      visitor_id: 'v_abc123',
      viewport_width: 1440,
    };
    const result = await registerSession(data);
    expect(result).toBe(true);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('derives device_type=mobile for viewport_width=375', async () => {
    const data: HieSessionData = {
      session_id: 'hs_abc123',
      visitor_id: 'v_abc123',
      viewport_width: 375,
    };
    const result = await registerSession(data);
    expect(result).toBe(true);
    // The tagged template call passes device_type as one of the interpolated values
    const callArgs = mockSql.mock.calls[0];
    const values = callArgs.slice(1).flat();
    expect(values).toContain('mobile');
  });

  it('derives device_type=tablet for viewport_width=800', async () => {
    const data: HieSessionData = {
      session_id: 'hs_abc123',
      visitor_id: 'v_abc123',
      viewport_width: 800,
    };
    const result = await registerSession(data);
    expect(result).toBe(true);
    const callArgs = mockSql.mock.calls[0];
    const values = callArgs.slice(1).flat();
    expect(values).toContain('tablet');
  });

  it('derives device_type=desktop for viewport_width=1440', async () => {
    const data: HieSessionData = {
      session_id: 'hs_abc123',
      visitor_id: 'v_abc123',
      viewport_width: 1440,
    };
    const result = await registerSession(data);
    expect(result).toBe(true);
    const callArgs = mockSql.mock.calls[0];
    const values = callArgs.slice(1).flat();
    expect(values).toContain('desktop');
  });
});

describe('ingestBatch', () => {
  beforeEach(() => {
    mockSql.mockClear();
    mockSql.mockResolvedValue([]);
  });

  it('routes scroll_depth events (accepted count increases)', async () => {
    const events: HieEvent[] = [
      {
        event_type: 'scroll_depth',
        session_id: 'hs_abc123',
        visitor_id: 'v_abc123',
        scroll_y: 500,
        scroll_percent: 50,
      },
    ];
    const result = await ingestBatch(events);
    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(0);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('routes click_interaction events (accepted count increases)', async () => {
    const events: HieEvent[] = [
      {
        event_type: 'click_interaction',
        session_id: 'hs_abc123',
        visitor_id: 'v_abc123',
        x: 100,
        y: 200,
      },
    ];
    const result = await ingestBatch(events);
    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(0);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown event_type (rejected count increases)', async () => {
    const events: HieEvent[] = [
      {
        event_type: 'unknown_event',
        session_id: 'hs_abc123',
        visitor_id: 'v_abc123',
      },
    ];
    const result = await ingestBatch(events);
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(1);
    expect(mockSql).not.toHaveBeenCalled();
  });

  it('rejects events with missing session_id', async () => {
    const events: HieEvent[] = [
      {
        event_type: 'scroll_depth',
        session_id: '',
        visitor_id: 'v_abc123',
      },
    ];
    const result = await ingestBatch(events);
    expect(result.accepted).toBe(0);
    expect(result.rejected).toBe(1);
    expect(mockSql).not.toHaveBeenCalled();
  });
});
