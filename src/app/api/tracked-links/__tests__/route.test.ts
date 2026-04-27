import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '../route';

// Mock dependencies
vi.mock('@/lib/permissions', () => ({
  getAuthContext: vi.fn(),
}));
vi.mock('@/lib/db/intake', () => ({
  getIntakeRequest: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  getDb: vi.fn(),
}));
vi.mock('@/lib/tracked-links/slug-generator', () => ({
  generateSlug: vi.fn(() => 'Abc123'),
}));

import { getAuthContext } from '@/lib/permissions';
import { getIntakeRequest } from '@/lib/db/intake';
import { getDb } from '@/lib/db';

const mockGetAuthContext = getAuthContext as ReturnType<typeof vi.fn>;
const mockGetIntakeRequest = getIntakeRequest as ReturnType<typeof vi.fn>;
const mockGetDb = getDb as ReturnType<typeof vi.fn>;

// Helper: create a mock SQL tagged-template function
// Must work both as fn() and as fn`template` (tagged template)
function createMockSql(returnValues: unknown[][] = [[]]) {
  let callIndex = 0;
  const fn = vi.fn(async (..._args: unknown[]) => {
    const result = returnValues[callIndex] ?? [];
    callIndex++;
    return result;
  });
  return fn;
}

// Helper: create POST request
function makePostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/tracked-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Helper: create GET request
function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost:3000/api/tracked-links');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: 'GET' });
}

const VALID_BODY = {
  request_id: 'test-request-id',
  asset_id: 'test-asset-id',
  base_url: 'https://example.com/apply',
  utm_source: 'social',
  utm_medium: 'referral',
  utm_term: 'SJ',
  utm_content: 'linkedin_post',
};

const APPROVED_CAMPAIGN = {
  id: 'test-request-id',
  status: 'approved',
  campaign_slug: 'test-campaign',
  title: 'Test Campaign',
  task_type: 'data_collection',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// POST /api/tracked-links
// ============================================================

describe('POST /api/tracked-links', () => {
  // ─── Auth tests ────────────────────────────────────────────

  it('returns 401 when getAuthContext returns null', async () => {
    mockGetAuthContext.mockResolvedValue(null);
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when role is "viewer"', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'viewer' });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
  });

  it('returns 403 when role is "designer"', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'designer' });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
  });

  // ─── Validation tests ──────────────────────────────────────

  it('returns 400 for invalid JSON body', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const req = new Request('http://localhost:3000/api/tracked-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json{{{',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid JSON body');
  });

  it('returns 400 when request_id is missing', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const body = { ...VALID_BODY };
    delete (body as Record<string, unknown>).request_id;
    const res = await POST(makePostRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Missing required fields');
  });

  it('returns 400 when base_url is missing', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const body = { ...VALID_BODY };
    delete (body as Record<string, unknown>).base_url;
    const res = await POST(makePostRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Missing required fields');
  });

  it('returns 400 when utm_source is missing', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const body = { ...VALID_BODY };
    delete (body as Record<string, unknown>).utm_source;
    const res = await POST(makePostRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Missing required fields');
  });

  it('returns 400 INVALID_SOURCE for invalid utm_source value', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const body = { ...VALID_BODY, utm_source: 'invalid' };
    const res = await POST(makePostRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('INVALID_SOURCE');
  });

  it('returns 400 INVALID_CONTENT when utm_content does not match source', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    // "glassdoor" belongs to "job_board", not "social"
    const body = { ...VALID_BODY, utm_source: 'social', utm_content: 'glassdoor' };
    const res = await POST(makePostRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('INVALID_CONTENT');
  });

  // ─── Campaign tests ────────────────────────────────────────

  it('returns 404 when campaign does not exist', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    mockGetIntakeRequest.mockResolvedValue(null);
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Campaign not found');
  });

  it('returns 403 when campaign status is "draft"', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    mockGetIntakeRequest.mockResolvedValue({ ...APPROVED_CAMPAIGN, status: 'draft' });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('approved');
  });

  it('returns 409 CAMPAIGN_SLUG_NOT_SET when campaign has no slug', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    mockGetIntakeRequest.mockResolvedValue({ ...APPROVED_CAMPAIGN, campaign_slug: null });
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('CAMPAIGN_SLUG_NOT_SET');
  });

  // ─── Landing page tests ────────────────────────────────────

  it('returns 409 LANDING_PAGES_NOT_SET when no landing pages exist', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    mockGetIntakeRequest.mockResolvedValue(APPROVED_CAMPAIGN);
    const mockSql = createMockSql([
      [{ job_posting_url: null, landing_page_url: null, ada_form_url: null }],
    ]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('LANDING_PAGES_NOT_SET');
  });

  it('returns 400 INVALID_BASE_URL when base_url is not one of the landing page URLs', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    mockGetIntakeRequest.mockResolvedValue(APPROVED_CAMPAIGN);
    const mockSql = createMockSql([
      [{ job_posting_url: 'https://other.com/job', landing_page_url: null, ada_form_url: null }],
    ]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('INVALID_BASE_URL');
  });

  // ─── utm_term tests ────────────────────────────────────────

  it('returns 400 when utm_term is only special characters (slugify returns "")', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    mockGetIntakeRequest.mockResolvedValue(APPROVED_CAMPAIGN);
    const mockSql = createMockSql([
      [{ job_posting_url: null, landing_page_url: 'https://example.com/apply', ada_form_url: null }],
    ]);
    mockGetDb.mockReturnValue(mockSql);
    const body = { ...VALID_BODY, utm_term: '!!!@@@###' };
    const res = await POST(makePostRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('utm_term');
  });

  // ─── Success test ──────────────────────────────────────────

  it('returns 200 with short_url on successful creation', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    mockGetIntakeRequest.mockResolvedValue(APPROVED_CAMPAIGN);
    const insertedRow = {
      id: 'new-link-id',
      slug: 'Abc123',
      request_id: 'test-request-id',
      asset_id: 'test-asset-id',
      recruiter_clerk_id: 'u1',
      destination_url: 'https://example.com/apply?utm_campaign=test-campaign&utm_source=social&utm_medium=referral&utm_term=sj&utm_content=linkedin_post',
      base_url: 'https://example.com/apply',
      utm_campaign: 'test-campaign',
      utm_source: 'social',
      utm_medium: 'referral',
      utm_term: 'sj',
      utm_content: 'linkedin_post',
      click_count: 0,
      last_clicked_at: null,
      created_at: new Date().toISOString(),
    };
    const mockSql = createMockSql([
      [{ job_posting_url: null, landing_page_url: 'https://example.com/apply', ada_form_url: null }],
      [insertedRow],
    ]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.short_url).toContain('/r/');
    expect(json.id).toBe('new-link-id');
  });

  // ─── Slug collision retry test ─────────────────────────────

  it('retries on slug collision and succeeds', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    mockGetIntakeRequest.mockResolvedValue(APPROVED_CAMPAIGN);

    const insertedRow = {
      id: 'new-link-id',
      slug: 'Abc123',
      request_id: 'test-request-id',
      asset_id: 'test-asset-id',
      recruiter_clerk_id: 'u1',
      destination_url: 'https://example.com/apply?utm_campaign=test-campaign',
      base_url: 'https://example.com/apply',
      utm_campaign: 'test-campaign',
      utm_source: 'social',
      utm_medium: 'referral',
      utm_term: 'sj',
      utm_content: 'linkedin_post',
      click_count: 0,
      last_clicked_at: null,
      created_at: new Date().toISOString(),
    };

    let sqlCallCount = 0;
    const mockSql = vi.fn(async () => {
      sqlCallCount++;
      // First call: landing pages query
      if (sqlCallCount === 1) {
        return [{ job_posting_url: null, landing_page_url: 'https://example.com/apply', ada_form_url: null }];
      }
      // Second call: first INSERT attempt — throw unique constraint error
      if (sqlCallCount === 2) {
        throw new Error('duplicate key value violates unique constraint');
      }
      // Third call: second INSERT attempt — success
      return [insertedRow];
    });
    mockGetDb.mockReturnValue(mockSql);

    const res = await POST(makePostRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.short_url).toContain('/r/');
    expect(sqlCallCount).toBe(3); // 1 landing page + 1 failed insert + 1 success
  });
});

// ============================================================
// GET /api/tracked-links
// ============================================================

const TEST_LINKS = [
  {
    id: '1', slug: 'aaa111', request_id: 'r1', asset_id: null, recruiter_clerk_id: 'user1',
    destination_url: 'https://x.com', base_url: 'https://x.com', utm_campaign: 'test',
    utm_source: 'social', utm_medium: 'referral', utm_term: 'SJ', utm_content: 'linkedin_post',
    click_count: 50, last_clicked_at: new Date().toISOString(), created_at: new Date().toISOString(),
    asset_thumbnail: null, asset_platform: null,
  },
  {
    id: '2', slug: 'bbb222', request_id: 'r1', asset_id: null, recruiter_clerk_id: 'user1',
    destination_url: 'https://x.com', base_url: 'https://x.com', utm_campaign: 'test',
    utm_source: 'social', utm_medium: 'referral', utm_term: 'RK', utm_content: 'facebook',
    click_count: 30, last_clicked_at: new Date().toISOString(), created_at: new Date().toISOString(),
    asset_thumbnail: null, asset_platform: null,
  },
  {
    id: '3', slug: 'ccc333', request_id: 'r1', asset_id: null, recruiter_clerk_id: 'user2',
    destination_url: 'https://x.com', base_url: 'https://x.com', utm_campaign: 'test',
    utm_source: 'job_board', utm_medium: 'referral', utm_term: 'AL', utm_content: 'indeed',
    click_count: 20, last_clicked_at: null, created_at: new Date().toISOString(),
    asset_thumbnail: null, asset_platform: null,
  },
];

describe('GET /api/tracked-links', () => {
  // ─── Auth tests ────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    mockGetAuthContext.mockResolvedValue(null);
    const res = await GET(makeGetRequest({ request_id: 'r1' }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when request_id param is missing', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const res = await GET(makeGetRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('request_id');
  });

  // ─── Data tests ────────────────────────────────────────────

  it('returns links with correct short_url format', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const mockSql = createMockSql([TEST_LINKS]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await GET(makeGetRequest({ request_id: 'r1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.links[0].short_url).toContain('/r/aaa111');
    expect(json.links[1].short_url).toContain('/r/bbb222');
    expect(json.links[2].short_url).toContain('/r/ccc333');
  });

  it('returns correct summary.total_clicks', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const mockSql = createMockSql([TEST_LINKS]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await GET(makeGetRequest({ request_id: 'r1' }));
    const json = await res.json();
    expect(json.summary.total_clicks).toBe(100);
  });

  it('returns correct summary.total_links', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const mockSql = createMockSql([TEST_LINKS]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await GET(makeGetRequest({ request_id: 'r1' }));
    const json = await res.json();
    expect(json.summary.total_links).toBe(3);
  });

  it('returns correct summary.best_channel (social with 80 clicks)', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const mockSql = createMockSql([TEST_LINKS]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await GET(makeGetRequest({ request_id: 'r1' }));
    const json = await res.json();
    expect(json.summary.best_channel).toEqual({ name: 'social', clicks: 80, pct: 80 });
  });

  it('returns correct summary.recruiter_count (distinct utm_term values)', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const mockSql = createMockSql([TEST_LINKS]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await GET(makeGetRequest({ request_id: 'r1' }));
    const json = await res.json();
    expect(json.summary.recruiter_count).toBe(3); // SJ, RK, AL
  });

  it('returns correct summary.channel_count (distinct utm_source values)', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const mockSql = createMockSql([TEST_LINKS]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await GET(makeGetRequest({ request_id: 'r1' }));
    const json = await res.json();
    expect(json.summary.channel_count).toBe(2); // social, job_board
  });

  it('returns empty summary when no links exist', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const mockSql = createMockSql([[]]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await GET(makeGetRequest({ request_id: 'r1' }));
    const json = await res.json();
    expect(json.links).toEqual([]);
    expect(json.summary.total_clicks).toBe(0);
    expect(json.summary.total_links).toBe(0);
    expect(json.summary.best_channel).toBeNull();
    expect(json.summary.recruiter_count).toBe(0);
    expect(json.summary.channel_count).toBe(0);
  });

  it('limit param limits the returned links array but summary is computed from all links', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const mockSql = createMockSql([TEST_LINKS]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await GET(makeGetRequest({ request_id: 'r1', limit: '2' }));
    const json = await res.json();
    // Links limited to 2
    expect(json.links.length).toBe(2);
    // But summary is from all 3
    expect(json.summary.total_links).toBe(3);
    expect(json.summary.total_clicks).toBe(100);
  });

  it('utm_term filter works correctly', async () => {
    mockGetAuthContext.mockResolvedValue({ userId: 'u1', role: 'admin' });
    const mockSql = createMockSql([TEST_LINKS]);
    mockGetDb.mockReturnValue(mockSql);
    const res = await GET(makeGetRequest({ request_id: 'r1', utm_term: 'SJ' }));
    const json = await res.json();
    // Only SJ link returned
    expect(json.links.length).toBe(1);
    expect(json.links[0].utm_term).toBe('SJ');
    // Summary still computed from all links (unfiltered)
    expect(json.summary.total_links).toBe(3);
    expect(json.summary.total_clicks).toBe(100);
  });
});
