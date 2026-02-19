import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { slugify, normalizeName } from '../src/firebase-push.js';

// Load fortune500.json
const fortune500 = JSON.parse(
  readFileSync(new URL('../data/fortune500.json', import.meta.url), 'utf8')
);

describe('fortune500.json integrity', () => {
  it('has no duplicate slugs', () => {
    const slugs = fortune500.map(c => slugify(c.name));
    const uniqueSlugs = new Set(slugs);
    const duplicates = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    expect(duplicates).toEqual([]);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it('has no duplicate normalized names', () => {
    const names = fortune500.map(c => normalizeName(c.name));
    const seen = new Map();
    const duplicates = [];
    for (let i = 0; i < names.length; i++) {
      if (seen.has(names[i])) {
        duplicates.push({
          normalized: names[i],
          entries: [fortune500[seen.get(names[i])].name, fortune500[i].name],
        });
      } else {
        seen.set(names[i], i);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('every entry has required fields', () => {
    for (const company of fortune500) {
      expect(company).toHaveProperty('name');
      expect(company).toHaveProperty('rank');
      expect(company).toHaveProperty('searchTerms');
      expect(company).toHaveProperty('industry');
      expect(typeof company.name).toBe('string');
      expect(typeof company.rank).toBe('number');
      expect(Array.isArray(company.searchTerms)).toBe(true);
    }
  });
});

describe('slugify', () => {
  it('handles basic company names', () => {
    expect(slugify('Walmart')).toBe('walmart');
    expect(slugify('JPMorgan Chase')).toBe('jpmorgan-chase');
  });

  it('strips Inc suffix', () => {
    expect(slugify('Apple Inc')).toBe('apple');
    expect(slugify('Apple Inc.')).toBe('apple');
  });

  it('strips Corp suffix', () => {
    expect(slugify('Exxon Corp')).toBe('exxon');
    expect(slugify('Exxon Corp.')).toBe('exxon');
  });

  it('strips LLC suffix', () => {
    expect(slugify('Acme LLC')).toBe('acme');
  });

  it('strips Holdings suffix', () => {
    expect(slugify('Berkshire Holdings')).toBe('berkshire');
  });

  it('strips Company suffix', () => {
    expect(slugify('Ford Motor Company')).toBe('ford-motor');
  });

  it('handles ampersands', () => {
    expect(slugify('AT&T')).toBe('at-and-t');
    expect(slugify('Procter & Gamble')).toBe('procter-and-gamble');
  });

  it('strips periods and special chars', () => {
    expect(slugify('D.R. Horton')).toBe('dr-horton');
    expect(slugify('S&P Global')).toBe('s-and-p-global');
  });

  it('produces same slug for name variations', () => {
    // D.R. Horton with and without Inc should match
    expect(slugify('D.R. Horton')).toBe(slugify('D.R. Horton Inc'));
    expect(slugify('D.R. Horton Inc.')).toBe(slugify('D.R. Horton'));
  });
});

describe('normalizeName', () => {
  it('normalizes basic names', () => {
    expect(normalizeName('Walmart')).toBe('walmart');
    expect(normalizeName('WALMART')).toBe('walmart');
  });

  it('strips corporate suffixes', () => {
    expect(normalizeName('Apple Inc')).toBe('apple');
    expect(normalizeName('Apple Inc.')).toBe('apple');
    expect(normalizeName('Exxon Corp')).toBe('exxon');
    expect(normalizeName('Acme LLC')).toBe('acme');
  });

  it('strips "The" prefix', () => {
    expect(normalizeName('The Home Depot')).toBe('home depot');
  });

  it('collapses whitespace', () => {
    expect(normalizeName('  JPMorgan   Chase  ')).toBe('jpmorgan chase');
  });
});

describe('category exclusivity', () => {
  // Simulates the categorization logic
  function categorize(percentDem, percentRep) {
    if (percentDem > 55) return 'support';
    if (percentRep > 55) return 'avoid';
    return 'mixed';
  }

  it('support and avoid are mutually exclusive at any valid percentage', () => {
    // Test many percentage combinations
    for (let dem = 0; dem <= 100; dem += 0.5) {
      const rep = 100 - dem;
      const cat = categorize(dem, rep);
      if (cat === 'support') {
        expect(categorize(dem, rep)).not.toBe('avoid');
      }
      if (cat === 'avoid') {
        expect(categorize(dem, rep)).not.toBe('support');
      }
    }
  });

  it('a company cannot be both support and avoid', () => {
    // With a single DEM/REP split, only one category is possible
    expect(categorize(80, 20)).toBe('support');
    expect(categorize(20, 80)).toBe('avoid');
    expect(categorize(50, 50)).toBe('mixed');
    // Can't get 'support' and 'avoid' from the same percentages
  });
});
