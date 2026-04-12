'use client';

import { TrackedLinksSummary } from '@/lib/types';

const CHANNEL_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'Twitter',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  job_board: 'Job Board',
  social: 'Social',
  email: 'Email',
  internal: 'Internal',
  influencer: 'Influencer',
};

function labelChannel(name: string): string {
  return CHANNEL_LABELS[name] ?? name;
}

interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  textValue?: boolean;
}

function StatCard({ label, value, sub, textValue = false }: StatCardProps) {
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 10,
        padding: 18,
        border: '1px solid #E8E8EA',
        transition: 'box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow =
          '0 1px 3px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: '#8A8A8E',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: textValue ? 20 : 32,
          fontWeight: 800,
          letterSpacing: -1,
          color: '#1A1A1A',
          lineHeight: 1.1,
          marginBottom: 6,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#8A8A8E',
        }}
      >
        {sub}
      </div>
    </div>
  );
}

interface StatsRowProps {
  approvedCount: number;
  channelCount: number;
  summary: TrackedLinksSummary | null;
}

export function StatsRow({ approvedCount, channelCount, summary }: StatsRowProps) {
  const totalLinks = summary?.total_links ?? 0;
  const recruiterCount = summary?.recruiter_count ?? 0;
  const totalClicks = summary?.total_clicks ?? 0;
  const clicksToday = summary?.clicks_today ?? 0;
  const bestChannel = summary?.best_channel ?? null;

  const clicksSub =
    clicksToday > 0 ? `+${clicksToday} today` : 'No clicks yet';

  const topChannelValue = bestChannel ? labelChannel(bestChannel.name) : '—';
  const topChannelSub = bestChannel
    ? `${bestChannel.clicks} clicks · ${bestChannel.pct}%`
    : 'No data yet';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14,
        marginBottom: 22,
      }}
    >
      <StatCard
        label="Creatives"
        value={approvedCount}
        sub={`Across ${channelCount} channel${channelCount !== 1 ? 's' : ''}`}
      />
      <StatCard
        label="Links Created"
        value={totalLinks}
        sub={`By ${recruiterCount} recruiter${recruiterCount !== 1 ? 's' : ''}`}
      />
      <StatCard
        label="Total Clicks"
        value={totalClicks}
        sub={clicksSub}
      />
      <StatCard
        label="Top Channel"
        value={topChannelValue}
        sub={topChannelSub}
        textValue={!!bestChannel}
      />
    </div>
  );
}
