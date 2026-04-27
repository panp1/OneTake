/**
 * HIE Ingest — validates and stores behavioral events.
 */

import { getDb } from '@/lib/db';

export interface HieSessionData {
  session_id: string;
  visitor_id: string;
  landing_page_url?: string;
  referrer?: string;
  user_agent?: string;
  viewport_width?: number;
  viewport_height?: number;
  device_pixel_ratio?: number;
  screen_width?: number;
  screen_height?: number;
}

export interface HieEvent {
  event_type: string;
  session_id: string;
  visitor_id: string;
  page_url?: string;
  page_hash?: string;
  x?: number;
  y?: number;
  viewport_width?: number;
  viewport_height?: number;
  element_selector?: string;
  element_tag?: string;
  element_text?: string;
  event_data?: Record<string, unknown>;
  client_timestamp_ms?: number;
  // Scroll-specific
  scroll_y?: number;
  scroll_percent?: number;
  document_height?: number;
  direction?: string;
  milestone?: number;
}

const SCROLL_TYPES = ['scroll_depth'];
const INTERACTION_TYPES = ['click_interaction', 'cta_click', 'form_interaction', 'viewport_resize', 'mousemove_sample', 'element_visibility'];
const SESSION_ID_PATTERN = /^hs_[0-9a-f]{32}$/;
const VISITOR_ID_PATTERN = /^v_[0-9a-f]+$/;

function deriveDeviceType(viewportWidth: number | undefined): string {
  if (!viewportWidth) return 'unknown';
  if (viewportWidth < 768) return 'mobile';
  if (viewportWidth < 1024) return 'tablet';
  return 'desktop';
}

export async function registerSession(data: HieSessionData): Promise<boolean> {
  if (!data.session_id || !data.visitor_id) return false;

  const sql = getDb();
  try {
    await sql`
      INSERT INTO hie_sessions (session_id, visitor_id, landing_page_url, referrer, user_agent, viewport_width, viewport_height, device_pixel_ratio, device_type, screen_width, screen_height)
      VALUES (${data.session_id}, ${data.visitor_id}, ${data.landing_page_url ?? null}, ${data.referrer ?? null}, ${data.user_agent ?? null}, ${data.viewport_width ?? null}, ${data.viewport_height ?? null}, ${data.device_pixel_ratio ?? null}, ${deriveDeviceType(data.viewport_width)}, ${data.screen_width ?? null}, ${data.screen_height ?? null})
      ON CONFLICT (session_id) DO NOTHING
    `;
    return true;
  } catch (err) {
    console.error('[HIE] Session register error:', (err as Error).message);
    return false;
  }
}

export async function ingestBatch(events: HieEvent[]): Promise<{ accepted: number; rejected: number }> {
  const sql = getDb();
  let accepted = 0;
  let rejected = 0;

  for (const event of events) {
    if (!event.event_type || !event.session_id || !event.visitor_id) {
      rejected++;
      continue;
    }

    try {
      if (SCROLL_TYPES.includes(event.event_type)) {
        await sql`
          INSERT INTO hie_scroll_events (session_id, visitor_id, page_url, page_hash, scroll_y, scroll_percent, document_height, viewport_height, direction, milestone, client_timestamp_ms)
          VALUES (${event.session_id}, ${event.visitor_id}, ${event.page_url ?? null}, ${event.page_hash ?? null}, ${event.scroll_y ?? null}, ${event.scroll_percent ?? null}, ${event.document_height ?? null}, ${event.viewport_height ?? null}, ${event.direction ?? null}, ${event.milestone ?? null}, ${event.client_timestamp_ms ?? null})
        `;
      } else if (INTERACTION_TYPES.includes(event.event_type)) {
        await sql`
          INSERT INTO hie_interaction_events (session_id, visitor_id, event_type, page_url, page_hash, x, y, viewport_width, viewport_height, element_selector, element_tag, element_text, event_data, client_timestamp_ms)
          VALUES (${event.session_id}, ${event.visitor_id}, ${event.event_type}, ${event.page_url ?? null}, ${event.page_hash ?? null}, ${event.x ?? null}, ${event.y ?? null}, ${event.viewport_width ?? null}, ${event.viewport_height ?? null}, ${event.element_selector ?? null}, ${event.element_tag ?? null}, ${event.element_text ?? null}, ${JSON.stringify(event.event_data ?? {})}, ${event.client_timestamp_ms ?? null})
        `;
      } else {
        rejected++;
        continue;
      }
      accepted++;
    } catch (err) {
      rejected++;
      console.error('[HIE] Event ingest error:', (err as Error).message);
    }
  }

  return { accepted, rejected };
}
