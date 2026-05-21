import { describe, it, expect } from 'vitest';
import {
  getPriceCategory,
  getPriceCategoryColor,
  isOutdated,
  formatTimeAgo,
  calculateDistance,
  STATIONS,
  MANAUS_CENTER,
  stationMatchesSearch,
} from '../data/stations';

describe('getPriceCategory', () => {
  it('returns cheap for price <= 6.05', () => {
    expect(getPriceCategory(5.89)).toBe('cheap');
    expect(getPriceCategory(6.05)).toBe('cheap');
  });

  it('returns medium for price between 6.06 and 6.30', () => {
    expect(getPriceCategory(6.15)).toBe('medium');
    expect(getPriceCategory(6.30)).toBe('medium');
  });

  it('returns expensive for price > 6.30', () => {
    expect(getPriceCategory(6.35)).toBe('expensive');
    expect(getPriceCategory(7.00)).toBe('expensive');
  });
});

describe('getPriceCategoryColor', () => {
  it('returns green for cheap', () => {
    expect(getPriceCategoryColor('cheap')).toBe('#15803D');
    expect(getPriceCategoryColor('cheap', 'dark')).toBe('#22C55E');
  });

  it('returns amber for medium', () => {
    expect(getPriceCategoryColor('medium')).toBe('#F59E0B');
  });

  it('returns red for expensive', () => {
    expect(getPriceCategoryColor('expensive')).toBe('#DC2626');
  });
});

describe('isOutdated', () => {
  it('returns false for recent dates (< 48h)', () => {
    const recent = new Date(Date.now() - 10 * 60 * 60 * 1000); // 10h ago
    expect(isOutdated(recent)).toBe(false);
  });

  it('returns true for old dates (> 48h)', () => {
    const old = new Date(Date.now() - 50 * 60 * 60 * 1000); // 50h ago
    expect(isOutdated(old)).toBe(true);
  });
});

describe('formatTimeAgo', () => {
  it('returns minutes for < 1h', () => {
    const date = new Date(Date.now() - 30 * 60 * 1000);
    expect(formatTimeAgo(date)).toBe('30min atrás');
  });

  it('returns hours for < 24h', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatTimeAgo(date)).toBe('3h atrás');
  });

  it('returns days for > 24h', () => {
    const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(formatTimeAgo(date)).toBe('2d atrás');
  });
});

describe('calculateDistance', () => {
  it('returns 0 for same coordinates', () => {
    const dist = calculateDistance(-3.1019, -60.0250, -3.1019, -60.0250);
    expect(dist).toBe(0);
  });

  it('returns positive distance for different coordinates', () => {
    const dist = calculateDistance(-3.0910, -60.0175, -3.1320, -60.0580);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(10); // Should be within 10km in Manaus
  });
});

describe('STATIONS data', () => {
  it('has at least 5 stations', () => {
    expect(STATIONS.length).toBeGreaterThanOrEqual(5);
  });

  it('all stations have valid coordinates in Manaus area', () => {
    STATIONS.forEach(s => {
      expect(s.latitude).toBeGreaterThan(-4);
      expect(s.latitude).toBeLessThan(-2);
      expect(s.longitude).toBeGreaterThan(-61);
      expect(s.longitude).toBeLessThan(-59);
    });
  });

  it('all stations have at least one price', () => {
    STATIONS.forEach(s => {
      expect(s.prices.length).toBeGreaterThan(0);
    });
  });

  it('all prices are in reasonable range', () => {
    STATIONS.forEach(s => {
      s.prices.forEach(p => {
        expect(p.price).toBeGreaterThan(3);
        expect(p.price).toBeLessThan(10);
      });
    });
  });

  it('enriches OSM stations with searchable Manaus neighborhoods', () => {
    const neighborhoods = new Set(STATIONS.map(s => s.neighborhood));

    expect(neighborhoods.size).toBeGreaterThan(1);
    expect(neighborhoods.has('Manaus')).toBe(false);
  });

  it('matches stations by neighborhood without accents', () => {
    const station = STATIONS.find(s => s.neighborhood === 'Sao Jose Operario');

    expect(station).toBeTruthy();
    expect(stationMatchesSearch(station!, 'sao jose')).toBe(true);
  });

  it('keeps mock prices fresh enough for local demos', () => {
    const prices = STATIONS.flatMap(s => s.prices);
    const freshPrices = prices.filter(p => !isOutdated(p.updatedAt));

    expect(freshPrices.length).toBeGreaterThan(prices.length * 0.6);
  });
});

describe('MANAUS_CENTER', () => {
  it('has valid coordinates for Manaus', () => {
    expect(MANAUS_CENTER.latitude).toBeCloseTo(-3.10, 1);
    expect(MANAUS_CENTER.longitude).toBeCloseTo(-60.02, 1);
  });
});
