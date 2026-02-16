import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FEC_API_BASE, API_KEY, rateLimitedFetch, RateLimitExhaustedError } from './fec-api.js';

// Load Fortune 500 company data from external JSON
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fortune500Data = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'fortune500.json'), 'utf-8')
);

// Build COMPANY_PAC_MAPPING from JSON for backward compatibility
export const COMPANY_PAC_MAPPING = {};
const companyRankMap = {};

for (const entry of fortune500Data) {
  COMPANY_PAC_MAPPING[entry.name] = {
    searchTerms: entry.searchTerms,
    committeeId: entry.committeeId || null,
    industry: entry.industry
  };
  companyRankMap[entry.name] = entry.rank;
}

console.log(`Loaded ${fortune500Data.length} companies from fortune500.json`);

/**
 * Search for a committee by company name.
 * Always searches by name (ignoring potentially wrong committeeId values).
 * Prioritizes committees active in recent cycles.
 */
export async function searchCommittee(companyName) {
  const companyData = COMPANY_PAC_MAPPING[companyName];

  if (!companyData) {
    console.warn(`No mapping found for company: ${companyName}`);
    return null;
  }

  // Search by company name terms — most reliable approach
  for (const searchTerm of companyData.searchTerms) {
    try {
      const url = `${FEC_API_BASE}/committees/?api_key=${API_KEY}&q=${encodeURIComponent(searchTerm)}&committee_type=N&committee_type=Q&committee_type=O&per_page=20`;
      const data = await rateLimitedFetch(url);

      if (data.results && data.results.length > 0) {
        // Prefer committees active in recent cycles (2024 or 2026)
        const recentMatch = data.results.find(c =>
          c.name.toUpperCase().includes(searchTerm.toUpperCase()) &&
          c.cycles && (c.cycles.includes(2024) || c.cycles.includes(2026))
        );

        const anyMatch = data.results.find(c =>
          c.name.toUpperCase().includes(searchTerm.toUpperCase())
        );

        const match = recentMatch || anyMatch;
        if (match) return match;
      }
    } catch (error) {
      console.warn(`Failed to search for ${searchTerm}:`, error.message);
    }
  }

  return null;
}

/**
 * Fetch all committees (for discovery/exploratory use)
 */
export async function fetchCommittees(committeeTypes = ['N', 'Q', 'O'], page = 1) {
  const typeParams = committeeTypes.map(t => `committee_type=${t}`).join('&');
  const url = `${FEC_API_BASE}/committees/?api_key=${API_KEY}&${typeParams}&per_page=100&page=${page}`;

  const data = await rateLimitedFetch(url);
  return {
    results: data.results || [],
    pagination: data.pagination || {}
  };
}

/**
 * Fetch disbursements for a single two-year period.
 */
async function fetchDisbursementsForPeriod(committeeId, twoYearPeriod) {
  const allDisbursements = [];
  let lastIndex = null;
  let lastDate = null;

  try {
    while (true) {
      let url = `${FEC_API_BASE}/schedules/schedule_b/?api_key=${API_KEY}&committee_id=${committeeId}&two_year_transaction_period=${twoYearPeriod}&per_page=100`;

      if (lastIndex && lastDate) {
        url += `&last_index=${lastIndex}&last_disbursement_date=${lastDate}`;
      }

      const data = await rateLimitedFetch(url);

      if (!data.results || data.results.length === 0) break;

      const candidateContributions = data.results.filter(d => {
        const recipientType = d.recipient_committee_type;
        const purpose = (d.disbursement_description || '').toUpperCase();
        return recipientType === 'H' || recipientType === 'S' || recipientType === 'P' ||
               purpose.includes('CONTRIBUTION') || purpose.includes('CANDIDATE');
      });

      allDisbursements.push(...candidateContributions);

      if (!data.pagination || !data.pagination.last_indexes) break;
      const pagination = data.pagination.last_indexes;
      if (pagination.last_index && pagination.last_disbursement_date) {
        lastIndex = pagination.last_index;
        lastDate = pagination.last_disbursement_date;
      } else {
        break;
      }

      if (allDisbursements.length > 10000) break;
    }
  } catch (error) {
    console.error(`    Error fetching ${twoYearPeriod} disbursements for ${committeeId}:`, error.message);
  }

  return allDisbursements;
}

/**
 * Fetch disbursements (contributions to candidates) for a committee.
 * Tries multiple election cycles: 2026 (current), 2024, and 2022 as fallback.
 */
export async function fetchDisbursements(committeeId, twoYearPeriod = 2024) {
  console.log(`  Fetching disbursements for committee ${committeeId}...`);

  // Try current and recent cycles
  const periods = [2024, 2026, 2022];
  let allDisbursements = [];

  for (const period of periods) {
    const results = await fetchDisbursementsForPeriod(committeeId, period);
    if (results.length > 0) {
      console.log(`    ${period} cycle: ${results.length} candidate contributions`);
      allDisbursements.push(...results);
    }
  }

  console.log(`  Total disbursements retrieved: ${allDisbursements.length}`);
  return allDisbursements;
}

/**
 * Get candidate party affiliation
 */
export async function getCandidateInfo(candidateId) {
  try {
    const url = `${FEC_API_BASE}/candidate/${candidateId}/?api_key=${API_KEY}`;
    const data = await rateLimitedFetch(url);

    if (data.results && data.results.length > 0) {
      return data.results[0];
    }
  } catch (error) {
    console.warn(`Failed to fetch candidate ${candidateId}:`, error.message);
  }

  return null;
}

/**
 * Batch fetch candidate party info for many candidate IDs at once.
 * The /candidates/ endpoint accepts multiple candidate_id params (up to ~100 per request).
 * Returns a Map of candidateId -> party string (e.g. 'DEM', 'REP').
 */
export async function batchFetchCandidates(candidateIds) {
  const partyMap = new Map();
  if (candidateIds.length === 0) return partyMap;

  const BATCH_SIZE = 100; // FEC API allows up to ~100 IDs per request

  for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
    const batch = candidateIds.slice(i, i + BATCH_SIZE);
    const idParams = batch.map(id => `candidate_id=${id}`).join('&');

    try {
      let page = 1;
      while (true) {
        const url = `${FEC_API_BASE}/candidates/?api_key=${API_KEY}&${idParams}&per_page=100&page=${page}`;
        const data = await rateLimitedFetch(url);

        if (data.results) {
          for (const candidate of data.results) {
            partyMap.set(candidate.candidate_id, candidate.party || null);
          }
        }

        // Check for more pages
        if (data.pagination && data.pagination.pages > page) {
          page++;
        } else {
          break;
        }
      }
    } catch (error) {
      console.warn(`  Failed to batch fetch candidates (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, error.message);
    }
  }

  return partyMap;
}

/**
 * Get all companies that we can track
 */
export function getTrackedCompanies() {
  return Object.keys(COMPANY_PAC_MAPPING);
}

/**
 * Get company industry
 */
export function getCompanyIndustry(companyName) {
  return COMPANY_PAC_MAPPING[companyName]?.industry || 'Unknown';
}

/**
 * Get Fortune 500 rank for a company (or rank from extended tracking list)
 */
export function getCompanyRank(companyName) {
  return companyRankMap[companyName] || null;
}
