import { describe, it, expect, vi } from 'vitest';
import type { CountryQuota, GeneratedAsset, ComputeJob } from '@/lib/types';

describe('AllCountriesOverview - Data Logic', () => {
  // ── Test Fixtures ────────────────────────────────────────────────

  const mockQuotas: CountryQuota[] = [
    { country: 'Morocco', locale: 'ar_MA', total_volume: 500, rate: 17.5, currency: 'USD', demographics: [{ category: 'Ethnicity', value: 'Arab', percentage: 60, volume: 300 }] },
    { country: 'France', locale: 'fr_FR', total_volume: 800, rate: 37.5, currency: 'USD', demographics: [] },
    { country: 'Germany', locale: 'de_DE', total_volume: 300, rate: 37.5, currency: 'USD', demographics: [] },
  ];

  const mockJobs: ComputeJob[] = [
    { id: 'j1', request_id: 'r1', job_type: 'generate_country', status: 'complete', country: 'Morocco', stage_target: null, asset_id: null, feedback: null, feedback_data: null, error_message: null, started_at: null, completed_at: null, created_at: '2026-04-23' },
    { id: 'j2', request_id: 'r1', job_type: 'generate_country', status: 'processing', country: 'France', stage_target: 2, asset_id: null, feedback: null, feedback_data: null, error_message: null, started_at: null, completed_at: null, created_at: '2026-04-23' },
    { id: 'j3', request_id: 'r1', job_type: 'generate_country', status: 'pending', country: 'Germany', stage_target: null, asset_id: null, feedback: null, feedback_data: null, error_message: null, started_at: null, completed_at: null, created_at: '2026-04-23' },
  ];

  const mockAssets: GeneratedAsset[] = [
    { id: 'a1', request_id: 'r1', actor_id: null, asset_type: 'base_image', platform: 'facebook', format: '1080x1080', language: 'ar', country: 'Morocco', content: null, copy_data: null, blob_url: 'https://blob/1', evaluation_score: 0.9, evaluation_data: null, evaluation_passed: true, stage: 2, version: 1, created_at: '2026-04-23' },
    { id: 'a2', request_id: 'r1', actor_id: null, asset_type: 'composed_creative', platform: 'facebook', format: '1080x1080', language: 'ar', country: 'Morocco', content: null, copy_data: null, blob_url: 'https://blob/2', evaluation_score: 0.85, evaluation_data: null, evaluation_passed: true, stage: 4, version: 1, created_at: '2026-04-23' },
    { id: 'a3', request_id: 'r1', actor_id: null, asset_type: 'copy', platform: 'facebook', format: 'text', language: 'ar', country: 'Morocco', content: null, copy_data: null, blob_url: null, evaluation_score: 0.88, evaluation_data: null, evaluation_passed: true, stage: 3, version: 1, created_at: '2026-04-23' },
  ];

  // ── Status Detection Tests ───────────────────────────────────────

  describe('getCountryStatus', () => {
    function getCountryStatus(country: string, jobs: ComputeJob[]) {
      const job = jobs.find((j) => j.country === country && j.job_type === 'generate_country');
      if (!job) return { status: 'pending', stageTarget: null };
      return { status: job.status, stageTarget: job.stage_target };
    }

    it('returns complete for Morocco', () => {
      const result = getCountryStatus('Morocco', mockJobs);
      expect(result.status).toBe('complete');
    });

    it('returns processing with stage target for France', () => {
      const result = getCountryStatus('France', mockJobs);
      expect(result.status).toBe('processing');
      expect(result.stageTarget).toBe(2);
    });

    it('returns pending for Germany', () => {
      const result = getCountryStatus('Germany', mockJobs);
      expect(result.status).toBe('pending');
    });

    it('returns pending for unknown country', () => {
      const result = getCountryStatus('Japan', mockJobs);
      expect(result.status).toBe('pending');
      expect(result.stageTarget).toBeNull();
    });

    it('ignores non-country jobs', () => {
      const mixedJobs: ComputeJob[] = [
        ...mockJobs,
        { id: 'j4', request_id: 'r1', job_type: 'generate', status: 'complete', country: null, stage_target: null, asset_id: null, feedback: null, feedback_data: null, error_message: null, started_at: null, completed_at: null, created_at: '2026-04-23' },
      ];
      const result = getCountryStatus('Morocco', mixedJobs);
      expect(result.status).toBe('complete');
    });
  });

  // ── Asset Counting Tests ─────────────────────────────────────────

  describe('countAssets', () => {
    function countAssets(country: string, assets: GeneratedAsset[], type: string) {
      return assets.filter((a) => a.country === country && a.asset_type === type).length;
    }

    it('counts base_image for Morocco', () => {
      expect(countAssets('Morocco', mockAssets, 'base_image')).toBe(1);
    });

    it('counts composed_creative for Morocco', () => {
      expect(countAssets('Morocco', mockAssets, 'composed_creative')).toBe(1);
    });

    it('counts copy for Morocco', () => {
      expect(countAssets('Morocco', mockAssets, 'copy')).toBe(1);
    });

    it('returns 0 for country with no assets', () => {
      expect(countAssets('France', mockAssets, 'base_image')).toBe(0);
    });

    it('returns 0 for nonexistent asset type', () => {
      expect(countAssets('Morocco', mockAssets, 'video')).toBe(0);
    });
  });

  // ── Status Count Tests ───────────────────────────────────────────

  describe('statusCounts', () => {
    function computeStatusCounts(quotas: CountryQuota[], jobs: ComputeJob[]) {
      const statuses = quotas.map((q) => {
        const job = jobs.find((j) => j.country === q.country && j.job_type === 'generate_country');
        return job?.status || 'pending';
      });
      return {
        all: statuses.length,
        complete: statuses.filter(s => s === 'complete').length,
        processing: statuses.filter(s => s === 'processing').length,
        pending: statuses.filter(s => s === 'pending').length,
      };
    }

    it('computes correct status counts', () => {
      const counts = computeStatusCounts(mockQuotas, mockJobs);
      expect(counts.all).toBe(3);
      expect(counts.complete).toBe(1);
      expect(counts.processing).toBe(1);
      expect(counts.pending).toBe(1);
    });

    it('all pending when no jobs exist', () => {
      const counts = computeStatusCounts(mockQuotas, []);
      expect(counts.pending).toBe(3);
      expect(counts.complete).toBe(0);
    });
  });

  // ── Aggregate Stats Tests ────────────────────────────────────────

  describe('aggregateStats', () => {
    it('calculates total volume correctly', () => {
      const total = mockQuotas.reduce((sum, q) => sum + q.total_volume, 0);
      expect(total).toBe(1600); // 500 + 800 + 300
    });

    it('calculates average rate correctly', () => {
      const avg = mockQuotas.reduce((sum, q) => sum + q.rate, 0) / mockQuotas.length;
      expect(avg).toBeCloseTo(30.83, 1); // (17.5 + 37.5 + 37.5) / 3
    });

    it('counts total assets', () => {
      expect(mockAssets.length).toBe(3);
    });
  });

  // ── Filter Tests ─────────────────────────────────────────────────

  describe('statusFilter', () => {
    const countryData = mockQuotas.map((q) => {
      const job = mockJobs.find((j) => j.country === q.country && j.job_type === 'generate_country');
      return { quota: q, status: job?.status || 'pending' };
    });

    it('filter all shows everything', () => {
      const filtered = countryData;
      expect(filtered).toHaveLength(3);
    });

    it('filter complete shows only done', () => {
      const filtered = countryData.filter(c => c.status === 'complete');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].quota.country).toBe('Morocco');
    });

    it('filter processing shows only generating', () => {
      const filtered = countryData.filter(c => c.status === 'processing');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].quota.country).toBe('France');
    });

    it('filter pending shows only queued', () => {
      const filtered = countryData.filter(c => c.status === 'pending');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].quota.country).toBe('Germany');
    });
  });
});
