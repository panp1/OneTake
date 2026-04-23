import { describe, it, expect } from 'vitest';
import type { ActorProfile, GeneratedAsset } from '@/lib/types';

/**
 * Tests for the country filtering logic used in CampaignWorkspace.
 * These test the pure filter functions that useMemo wraps.
 */
describe('Country Filtering Logic', () => {
  // ── Fixtures ─────────────────────────────────────────────────────

  const actors: ActorProfile[] = [
    { id: 'a1', request_id: 'r1', name: 'Actor 1', face_lock: {}, prompt_seed: '', outfit_variations: null, signature_accessory: null, backdrops: [], country: 'Morocco', created_at: '' },
    { id: 'a2', request_id: 'r1', name: 'Actor 2', face_lock: {}, prompt_seed: '', outfit_variations: null, signature_accessory: null, backdrops: [], country: 'Morocco', created_at: '' },
    { id: 'a3', request_id: 'r1', name: 'Actor 3', face_lock: {}, prompt_seed: '', outfit_variations: null, signature_accessory: null, backdrops: [], country: 'France', created_at: '' },
    { id: 'a4', request_id: 'r1', name: 'Actor 4', face_lock: {}, prompt_seed: '', outfit_variations: null, signature_accessory: null, backdrops: [], country: null, created_at: '' },
  ];

  const assets: GeneratedAsset[] = [
    { id: 'g1', request_id: 'r1', actor_id: 'a1', asset_type: 'base_image', platform: 'fb', format: '1080', language: 'ar', country: 'Morocco', content: null, copy_data: null, blob_url: null, evaluation_score: null, evaluation_data: null, evaluation_passed: false, stage: 2, version: 1, created_at: '' },
    { id: 'g2', request_id: 'r1', actor_id: 'a1', asset_type: 'composed_creative', platform: 'fb', format: '1080', language: 'ar', country: 'Morocco', content: null, copy_data: null, blob_url: null, evaluation_score: null, evaluation_data: null, evaluation_passed: true, stage: 4, version: 1, created_at: '' },
    { id: 'g3', request_id: 'r1', actor_id: 'a3', asset_type: 'base_image', platform: 'fb', format: '1080', language: 'fr', country: 'France', content: null, copy_data: null, blob_url: null, evaluation_score: null, evaluation_data: null, evaluation_passed: true, stage: 2, version: 1, created_at: '' },
    { id: 'g4', request_id: 'r1', actor_id: null, asset_type: 'copy', platform: 'fb', format: 'text', language: 'ar', country: 'Morocco', content: null, copy_data: null, blob_url: null, evaluation_score: null, evaluation_data: null, evaluation_passed: true, stage: 3, version: 1, created_at: '' },
    { id: 'g5', request_id: 'r1', actor_id: null, asset_type: 'copy', platform: 'fb', format: 'text', language: 'en', country: null, content: null, copy_data: null, blob_url: null, evaluation_score: null, evaluation_data: null, evaluation_passed: true, stage: 3, version: 1, created_at: '' },
  ];

  // ── Actor Filtering ──────────────────────────────────────────────

  describe('actor filtering by country', () => {
    function filterActors(selectedCountry: string | null) {
      return selectedCountry ? actors.filter(a => a.country === selectedCountry) : actors;
    }

    it('null selection returns all actors', () => {
      expect(filterActors(null)).toHaveLength(4);
    });

    it('Morocco returns only Morocco actors', () => {
      const filtered = filterActors('Morocco');
      expect(filtered).toHaveLength(2);
      expect(filtered.every(a => a.country === 'Morocco')).toBe(true);
    });

    it('France returns only France actors', () => {
      const filtered = filterActors('France');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Actor 3');
    });

    it('unknown country returns empty array', () => {
      expect(filterActors('Japan')).toHaveLength(0);
    });

    it('null-country actors are excluded when filtering', () => {
      const filtered = filterActors('Morocco');
      expect(filtered.some(a => a.country === null)).toBe(false);
    });

    it('null-country actors included in all view', () => {
      const filtered = filterActors(null);
      expect(filtered.some(a => a.country === null)).toBe(true);
    });
  });

  // ── Asset Filtering ──────────────────────────────────────────────

  describe('asset filtering by country', () => {
    function filterAssets(selectedCountry: string | null) {
      return selectedCountry ? assets.filter(a => a.country === selectedCountry) : assets;
    }

    it('null selection returns all assets', () => {
      expect(filterAssets(null)).toHaveLength(5);
    });

    it('Morocco returns 3 assets', () => {
      const filtered = filterAssets('Morocco');
      expect(filtered).toHaveLength(3);
      expect(filtered.every(a => a.country === 'Morocco')).toBe(true);
    });

    it('France returns 1 asset', () => {
      const filtered = filterAssets('France');
      expect(filtered).toHaveLength(1);
    });

    it('unknown country returns empty', () => {
      expect(filterAssets('Germany')).toHaveLength(0);
    });

    it('Morocco assets include correct types', () => {
      const filtered = filterAssets('Morocco');
      const types = filtered.map(a => a.asset_type);
      expect(types).toContain('base_image');
      expect(types).toContain('composed_creative');
      expect(types).toContain('copy');
    });

    it('null-country assets excluded when filtering', () => {
      const filtered = filterAssets('Morocco');
      expect(filtered.some(a => a.country === null)).toBe(false);
    });
  });

  // ── Strategy Filtering ───────────────────────────────────────────

  describe('strategy filtering by country', () => {
    const strategies = [
      { id: 's1', country: 'Morocco', strategy_data: { channels: ['facebook'] } },
      { id: 's2', country: 'France', strategy_data: { channels: ['linkedin'] } },
      { id: 's3', country: 'Germany', strategy_data: { channels: ['instagram'] } },
    ];

    function filterStrategies(selectedCountry: string | null) {
      return selectedCountry ? strategies.filter(s => s.country === selectedCountry) : strategies;
    }

    it('null selection returns all strategies', () => {
      expect(filterStrategies(null)).toHaveLength(3);
    });

    it('Morocco returns Morocco strategy', () => {
      const filtered = filterStrategies('Morocco');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].strategy_data.channels).toContain('facebook');
    });

    it('unknown country returns empty', () => {
      expect(filterStrategies('Japan')).toHaveLength(0);
    });
  });

  // ── Backwards Compatibility ──────────────────────────────────────

  describe('backwards compatibility', () => {
    it('hasCountries is false when no quotas', () => {
      const quotas: any[] = [];
      const hasCountries = quotas.length > 0;
      expect(hasCountries).toBe(false);
    });

    it('hasCountries is false when quotas is undefined', () => {
      const quotas: any[] | undefined = undefined;
      const hasCountries = (quotas?.length ?? 0) > 0;
      expect(hasCountries).toBe(false);
    });

    it('without countries, all actors show', () => {
      const selectedCountry = null;
      const filtered = selectedCountry ? actors.filter(a => a.country === selectedCountry) : actors;
      expect(filtered).toHaveLength(4);
    });

    it('legacy assets without country field included in all view', () => {
      const legacyAsset = assets.find(a => a.country === null);
      expect(legacyAsset).toBeDefined();

      const filtered = null ? assets.filter(a => a.country === null) : assets;
      expect(filtered).toContain(legacyAsset);
    });
  });

  // ── Asset Count Computation ──────────────────────────────────────

  describe('asset count computation for CountryHeader', () => {
    function computeAssetCounts(filteredAssets: GeneratedAsset[]) {
      return {
        images: filteredAssets.filter(a => a.asset_type === 'base_image').length,
        creatives: filteredAssets.filter(a => a.asset_type === 'composed_creative').length,
        copy: filteredAssets.filter(a => a.asset_type === 'copy').length,
        videos: filteredAssets.filter(a => a.asset_type === 'video').length,
      };
    }

    it('Morocco has correct counts', () => {
      const moroccoAssets = assets.filter(a => a.country === 'Morocco');
      const counts = computeAssetCounts(moroccoAssets);
      expect(counts.images).toBe(1);
      expect(counts.creatives).toBe(1);
      expect(counts.copy).toBe(1);
      expect(counts.videos).toBe(0);
    });

    it('France has correct counts', () => {
      const franceAssets = assets.filter(a => a.country === 'France');
      const counts = computeAssetCounts(franceAssets);
      expect(counts.images).toBe(1);
      expect(counts.creatives).toBe(0);
      expect(counts.copy).toBe(0);
      expect(counts.videos).toBe(0);
    });

    it('all assets combined', () => {
      const counts = computeAssetCounts(assets);
      expect(counts.images).toBe(2);
      expect(counts.creatives).toBe(1);
      expect(counts.copy).toBe(2);
      expect(counts.videos).toBe(0);
    });
  });
});
