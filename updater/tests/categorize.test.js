import { describe, it, expect } from 'vitest';
import { calculateAggregateStats, sortCompanies } from '../src/categorize.js';

// Helper to test categorization thresholds (mirrors logic from categorizeCompany)
function categorize(percentDem, percentRep) {
  if (percentDem > 55) return 'support';
  if (percentRep > 55) return 'avoid';
  return 'mixed';
}

describe('categorization thresholds', () => {
  it('100% DEM → support', () => {
    expect(categorize(100, 0)).toBe('support');
  });

  it('100% REP → avoid', () => {
    expect(categorize(0, 100)).toBe('avoid');
  });

  it('50/50 → mixed', () => {
    expect(categorize(50, 50)).toBe('mixed');
  });

  it('55.1% DEM → support (just above threshold)', () => {
    expect(categorize(55.1, 44.9)).toBe('support');
  });

  it('55.0% DEM → mixed (at threshold, not above)', () => {
    expect(categorize(55, 45)).toBe('mixed');
  });

  it('55.1% REP → avoid (just above threshold)', () => {
    expect(categorize(44.9, 55.1)).toBe('avoid');
  });

  it('55.0% REP → mixed (at threshold, not above)', () => {
    expect(categorize(45, 55)).toBe('mixed');
  });
});

describe('calculateAggregateStats', () => {
  const companies = [
    { name: 'A', category: 'support', industry: 'Tech' },
    { name: 'B', category: 'support', industry: 'Tech' },
    { name: 'C', category: 'avoid', industry: 'Finance' },
    { name: 'D', category: 'mixed', industry: 'Tech' },
  ];

  it('counts by category', () => {
    const stats = calculateAggregateStats(companies);
    expect(stats.support).toBe(2);
    expect(stats.avoid).toBe(1);
    expect(stats.mixed).toBe(1);
    expect(stats.total).toBe(4);
  });

  it('counts by industry', () => {
    const stats = calculateAggregateStats(companies);
    expect(stats.byIndustry.Tech).toEqual({ total: 3, support: 2, avoid: 0, mixed: 1 });
    expect(stats.byIndustry.Finance).toEqual({ total: 1, support: 0, avoid: 1, mixed: 0 });
  });

  it('handles empty array', () => {
    const stats = calculateAggregateStats([]);
    expect(stats.total).toBe(0);
    expect(stats.support).toBe(0);
  });
});

describe('sortCompanies', () => {
  it('sorts support before mixed before avoid', () => {
    const companies = [
      { name: 'Avoid Co', category: 'avoid', percentDemocrat: 20, percentRepublican: 80 },
      { name: 'Support Co', category: 'support', percentDemocrat: 80, percentRepublican: 20 },
      { name: 'Mixed Co', category: 'mixed', percentDemocrat: 50, percentRepublican: 50 },
    ];
    const sorted = sortCompanies([...companies]);
    expect(sorted[0].name).toBe('Support Co');
    expect(sorted[1].name).toBe('Mixed Co');
    expect(sorted[2].name).toBe('Avoid Co');
  });

  it('within support, higher DEM% first', () => {
    const companies = [
      { name: 'Low', category: 'support', percentDemocrat: 60, percentRepublican: 40 },
      { name: 'High', category: 'support', percentDemocrat: 90, percentRepublican: 10 },
    ];
    const sorted = sortCompanies([...companies]);
    expect(sorted[0].name).toBe('High');
    expect(sorted[1].name).toBe('Low');
  });

  it('within avoid, higher REP% first', () => {
    const companies = [
      { name: 'Low', category: 'avoid', percentRepublican: 60, percentDemocrat: 40 },
      { name: 'High', category: 'avoid', percentRepublican: 90, percentDemocrat: 10 },
    ];
    const sorted = sortCompanies([...companies]);
    expect(sorted[0].name).toBe('High');
    expect(sorted[1].name).toBe('Low');
  });
});
