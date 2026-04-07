import { getAuthContext } from '@/lib/permissions';
import { getDb } from '@/lib/db';
import { getIntakeRequest } from '@/lib/db/intake';
import { slugify } from '@/lib/slugify';
import { buildDestinationUrl } from '@/lib/tracked-links/build-url';
import { generateSlug } from '@/lib/tracked-links/slug-generator';

const MAX_TERM_LEN = 60;
const MAX_CONTENT_LEN = 60;
const MAX_SLUG_RETRIES = 5;

function getAppOrigin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  try {
    return new URL(request.url).origin;
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (ctx.role !== 'recruiter' && ctx.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: {
    request_id?: string;
    asset_id?: string | null;
    base_url?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_term?: string;
    utm_content?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.request_id || !body.base_url || !body.utm_source || !body.utm_term || !body.utm_content) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const intake = await getIntakeRequest(body.request_id);
  if (!intake) {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (intake.status !== 'approved' && intake.status !== 'sent') {
    return Response.json(
      { error: 'Campaign must be approved before tracked links can be created' },
      { status: 403 }
    );
  }
  if (!intake.campaign_slug) {
    return Response.json(
      { error: 'CAMPAIGN_SLUG_NOT_SET', message: 'Campaign tracking code not set — contact admin.' },
      { status: 409 }
    );
  }

  // Readiness gate: at least one landing page URL must be set
  const sql = getDb();
  const lpRows = await sql`
    SELECT job_posting_url, landing_page_url, ada_form_url
      FROM campaign_landing_pages
     WHERE request_id = ${body.request_id}
     LIMIT 1
  ` as unknown as Array<{
    job_posting_url: string | null;
    landing_page_url: string | null;
    ada_form_url: string | null;
  }>;
  const lp = lpRows[0];

  const candidateUrls = [lp?.job_posting_url, lp?.landing_page_url, lp?.ada_form_url].filter(Boolean) as string[];
  if (candidateUrls.length === 0) {
    return Response.json(
      {
        error: 'LANDING_PAGES_NOT_SET',
        message: 'Marketing or designer must add at least one landing page URL before tracked links can be built.',
      },
      { status: 409 }
    );
  }
  if (!candidateUrls.includes(body.base_url)) {
    return Response.json({ error: 'INVALID_BASE_URL' }, { status: 400 });
  }

  // Server-side re-slugify (client state is untrusted)
  const utm_term = slugify(body.utm_term, MAX_TERM_LEN);
  const utm_content = slugify(body.utm_content, MAX_CONTENT_LEN);
  if (!utm_term || !utm_content) {
    return Response.json(
      { error: 'utm_term and utm_content must contain at least one alphanumeric character' },
      { status: 400 }
    );
  }

  const utm_medium = (body.utm_medium || 'social').trim();
  if (!utm_medium) {
    return Response.json({ error: 'utm_medium must be non-empty' }, { status: 400 });
  }

  // Build the destination URL with all UTM params pre-appended
  const destination_url = buildDestinationUrl(body.base_url, {
    utm_campaign: intake.campaign_slug,
    utm_source: body.utm_source,
    utm_medium,
    utm_term,
    utm_content,
  });

  // Mint a unique slug with retry loop for the UNIQUE constraint
  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = generateSlug();
    try {
      const rows = await sql`
        INSERT INTO tracked_links (
          slug, request_id, asset_id, recruiter_clerk_id,
          destination_url, base_url,
          utm_campaign, utm_source, utm_medium, utm_term, utm_content
        ) VALUES (
          ${slug}, ${body.request_id}, ${body.asset_id ?? null}, ${ctx.userId},
          ${destination_url}, ${body.base_url},
          ${intake.campaign_slug}, ${body.utm_source}, ${utm_medium}, ${utm_term}, ${utm_content}
        )
        RETURNING *
      `;
      const row = rows[0];
      const appOrigin = getAppOrigin(request);
      return Response.json({
        ...row,
        short_url: `${appOrigin}/r/${slug}`,
      });
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (attempt < MAX_SLUG_RETRIES - 1 && /duplicate|unique/i.test(msg)) {
        continue;
      }
      console.error('[api/tracked-links] POST failed:', e);
      if (/duplicate|unique/i.test(msg)) {
        return Response.json(
          { error: 'SLUG_COLLISION', message: 'Could not mint a unique slug. Try again.' },
          { status: 500 }
        );
      }
      return Response.json({ error: 'Failed to create tracked link' }, { status: 500 });
    }
  }

  return Response.json({ error: 'SLUG_COLLISION' }, { status: 500 });
}
