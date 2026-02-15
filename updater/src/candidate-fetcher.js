import dotenv from 'dotenv';
dotenv.config();

const FEC_API_BASE = 'https://api.open.fec.gov/v1';
const API_KEY = process.env.FEC_API_KEY;
let RATE_LIMIT_DELAY = 3600;

// Rate limiting utility (shared pattern with fec-client.js)
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let lastRequestTime = 0;
let consecutive429s = 0;
const MAX_CONSECUTIVE_429S = 8;
const MAX_RETRIES = 5;

class RateLimitExhaustedError extends Error {
  constructor() {
    super('FEC API rate limit exhausted. Get a real API key at https://api.data.gov/signup');
    this.name = 'RateLimitExhaustedError';
  }
}

async function rateLimitedFetch(url) {
  if (consecutive429s >= MAX_CONSECUTIVE_429S) {
    throw new RateLimitExhaustedError();
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await sleep(RATE_LIMIT_DELAY - timeSinceLastRequest);
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    lastRequestTime = Date.now();
    const response = await fetch(url);

    if (response.status === 429) {
      consecutive429s++;
      if (consecutive429s >= MAX_CONSECUTIVE_429S) {
        throw new RateLimitExhaustedError();
      }
      const backoff = Math.min(10000 * Math.pow(2, attempt), 120000);
      console.log(`    Rate limited (429). Retrying in ${backoff / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(backoff);
      continue;
    }

    if (!response.ok) {
      throw new Error(`FEC API error: ${response.status} ${response.statusText}`);
    }

    consecutive429s = 0;
    return response.json();
  }

  throw new Error('FEC API error: 429 Too Many Requests (retries exhausted)');
}

// Wake County NC congressional districts (2024 redistricting)
// NC-02 covers most of Wake County (Raleigh)
// NC-13 covers parts of Wake County
const WAKE_COUNTY_DISTRICTS = ['02', '13'];
const STATE = 'NC';

// Election cycles to search
const ELECTION_CYCLES = [2024, 2026];

/**
 * Search for federal candidates in NC by office type.
 * office: H (House), S (Senate), P (President)
 */
async function searchFederalCandidates(office, district = null) {
  const candidates = [];

  for (const cycle of ELECTION_CYCLES) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      let url = `${FEC_API_BASE}/candidates/search/?api_key=${API_KEY}&state=${STATE}&office=${office}&cycle=${cycle}&is_active_candidate=true&per_page=100&page=${page}&sort=name`;

      if (district) {
        url += `&district=${district}`;
      }

      try {
        const data = await rateLimitedFetch(url);

        if (data.results && data.results.length > 0) {
          for (const candidate of data.results) {
            // Deduplicate by candidate_id
            if (!candidates.find(c => c.candidate_id === candidate.candidate_id)) {
              candidates.push(candidate);
            }
          }
        }

        hasMore = data.pagination && data.pagination.pages > page;
        page++;
      } catch (error) {
        console.warn(`  Error searching ${office} candidates (cycle ${cycle}, page ${page}):`, error.message);
        hasMore = false;
      }
    }
  }

  return candidates;
}

/**
 * Fetch all Wake County relevant candidates.
 * Returns array of candidate objects from FEC API.
 */
export async function fetchWakeCountyCandidates() {
  console.log('\nFetching Wake County NC candidates...');
  const allCandidates = [];
  const seenIds = new Set();

  function addUnique(candidates) {
    for (const c of candidates) {
      if (!seenIds.has(c.candidate_id)) {
        seenIds.add(c.candidate_id);
        allCandidates.push(c);
      }
    }
  }

  // NC Senate candidates (statewide)
  console.log('  Searching NC Senate candidates...');
  const senateCandidates = await searchFederalCandidates('S');
  console.log(`    Found ${senateCandidates.length} Senate candidates`);
  addUnique(senateCandidates);

  // NC House candidates for Wake County districts
  for (const district of WAKE_COUNTY_DISTRICTS) {
    console.log(`  Searching NC House District ${district} candidates...`);
    const houseCandidates = await searchFederalCandidates('H', district);
    console.log(`    Found ${houseCandidates.length} House-${district} candidates`);
    addUnique(houseCandidates);
  }

  console.log(`  Total unique federal candidates found: ${allCandidates.length}`);
  return allCandidates;
}

/**
 * Fetch the principal campaign committee for a candidate.
 * This is the committee that receives contributions on behalf of the candidate.
 */
async function fetchCandidateCommittee(candidateId) {
  try {
    const url = `${FEC_API_BASE}/candidate/${candidateId}/committees/?api_key=${API_KEY}&designation=P&per_page=5`;
    const data = await rateLimitedFetch(url);

    if (data.results && data.results.length > 0) {
      // Return the most recently active principal committee
      return data.results[0];
    }
  } catch (error) {
    console.warn(`  Could not fetch committee for ${candidateId}:`, error.message);
  }
  return null;
}

/**
 * Fetch contribution totals for a candidate from FEC.
 */
async function fetchCandidateTotals(candidateId) {
  try {
    const url = `${FEC_API_BASE}/candidate/${candidateId}/totals/?api_key=${API_KEY}&per_page=5&sort=-cycle`;
    const data = await rateLimitedFetch(url);

    if (data.results && data.results.length > 0) {
      return data.results[0]; // Most recent cycle
    }
  } catch (error) {
    console.warn(`  Could not fetch totals for ${candidateId}:`, error.message);
  }
  return null;
}

/**
 * Fetch Schedule A (contributions received) for a committee.
 * Returns top donors grouped by contributor name.
 */
async function fetchContributions(committeeId, limit = 500) {
  const allContributions = [];
  let lastIndex = null;
  let lastContributionDate = null;

  // Fetch from recent cycles
  for (const period of [2024, 2026]) {
    let pagesFetched = 0;

    while (allContributions.length < limit) {
      let url = `${FEC_API_BASE}/schedules/schedule_a/?api_key=${API_KEY}&committee_id=${committeeId}&two_year_transaction_period=${period}&per_page=100&sort=-contribution_receipt_amount`;

      if (lastIndex && lastContributionDate) {
        url += `&last_index=${lastIndex}&last_contribution_receipt_date=${lastContributionDate}`;
      }

      try {
        const data = await rateLimitedFetch(url);

        if (!data.results || data.results.length === 0) break;

        allContributions.push(...data.results);
        pagesFetched++;

        if (!data.pagination || !data.pagination.last_indexes) break;
        const pagination = data.pagination.last_indexes;
        if (pagination.last_index && pagination.last_contribution_receipt_date) {
          lastIndex = pagination.last_index;
          lastContributionDate = pagination.last_contribution_receipt_date;
        } else {
          break;
        }

        // Limit pages to avoid excessive API calls
        if (pagesFetched >= 5) break;
      } catch (error) {
        console.warn(`    Error fetching contributions for ${committeeId} (${period}):`, error.message);
        break;
      }
    }

    // Reset pagination for next period
    lastIndex = null;
    lastContributionDate = null;
  }

  return allContributions;
}

/**
 * Aggregate contributions by donor.
 * Groups individual contributions and identifies PAC vs individual donors.
 */
function aggregateDonors(contributions) {
  const donorMap = new Map();

  for (const contribution of contributions) {
    const amount = parseFloat(contribution.contribution_receipt_amount) || 0;
    if (amount <= 0) continue;

    // Determine donor type and name
    const committeeType = contribution.contributor_committee_type;
    const entityType = contribution.entity_type;

    let donorName;
    let donorType;

    if (committeeType || entityType === 'COM' || entityType === 'PAC' || entityType === 'ORG') {
      // PAC or organization
      donorName = contribution.contributor_name || contribution.committee_name || 'Unknown PAC';
      donorType = 'pac';
    } else if (entityType === 'IND' || !entityType) {
      // Individual contributor
      donorName = contribution.contributor_name || 'Unknown Individual';
      donorType = 'individual';
    } else {
      donorName = contribution.contributor_name || 'Unknown';
      donorType = 'other';
    }

    // Normalize the name
    donorName = donorName.trim().toUpperCase();

    const key = `${donorType}:${donorName}`;

    if (donorMap.has(key)) {
      const existing = donorMap.get(key);
      existing.totalAmount += amount;
      existing.contributionCount++;
      if (contribution.contributor_employer) {
        existing.employer = contribution.contributor_employer;
      }
      if (contribution.contributor_state) {
        existing.state = contribution.contributor_state;
      }
    } else {
      donorMap.set(key, {
        name: donorName,
        type: donorType,
        totalAmount: amount,
        contributionCount: 1,
        employer: contribution.contributor_employer || null,
        state: contribution.contributor_state || null,
      });
    }
  }

  // Convert to sorted array (top donors first)
  const donors = Array.from(donorMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount);

  return donors;
}

/**
 * Process a single candidate — fetch their committee, contributions, and aggregate donors.
 * Returns a structured candidate object ready for Firestore.
 */
export async function processCandidate(fecCandidate) {
  const candidateId = fecCandidate.candidate_id;
  const name = fecCandidate.name || 'Unknown';
  const party = fecCandidate.party || 'UNK';
  const office = fecCandidate.office;
  const district = fecCandidate.district || null;
  const state = fecCandidate.state;
  const incumbentChallenger = fecCandidate.incumbent_challenge || null;

  console.log(`\n  Processing: ${name} (${party}) - ${office}${district ? `-${district}` : ''}`);

  // Determine office display label
  let officeLabel;
  if (office === 'S') {
    officeLabel = 'US Senate';
  } else if (office === 'H') {
    officeLabel = `US House NC-${district}`;
  } else if (office === 'P') {
    officeLabel = 'President';
  } else {
    officeLabel = office;
  }

  // Fetch principal campaign committee
  const committee = await fetchCandidateCommittee(candidateId);
  if (!committee) {
    console.log(`    No committee found for ${name}`);
    return {
      candidateId,
      name: formatCandidateName(name),
      party,
      office: officeLabel,
      officeCode: office,
      district,
      state,
      incumbentChallenger,
      totalRaised: 0,
      totalFromPacs: 0,
      totalFromIndividuals: 0,
      donors: [],
      committeeId: null,
      error: 'No committee found',
    };
  }

  console.log(`    Committee: ${committee.name} (${committee.committee_id})`);

  // Fetch totals
  const totals = await fetchCandidateTotals(candidateId);

  // Fetch contributions (Schedule A)
  console.log(`    Fetching contributions...`);
  const contributions = await fetchContributions(committee.committee_id);
  console.log(`    Retrieved ${contributions.length} contribution records`);

  // Aggregate by donor
  const donors = aggregateDonors(contributions);
  console.log(`    Aggregated into ${donors.length} unique donors`);

  // Calculate totals from our aggregated data
  const totalFromPacs = donors
    .filter(d => d.type === 'pac')
    .reduce((sum, d) => sum + d.totalAmount, 0);
  const totalFromIndividuals = donors
    .filter(d => d.type === 'individual')
    .reduce((sum, d) => sum + d.totalAmount, 0);
  const totalFromOther = donors
    .filter(d => d.type === 'other')
    .reduce((sum, d) => sum + d.totalAmount, 0);

  // Use FEC totals if available, otherwise our calculated totals
  const totalRaised = totals?.receipts || (totalFromPacs + totalFromIndividuals + totalFromOther);

  // Keep top 50 donors for the detail view
  const topDonors = donors.slice(0, 50).map(d => ({
    name: d.name,
    type: d.type,
    totalAmount: Math.round(d.totalAmount * 100) / 100,
    contributionCount: d.contributionCount,
    employer: d.employer,
    state: d.state,
  }));

  const result = {
    candidateId,
    name: formatCandidateName(name),
    party,
    office: officeLabel,
    officeCode: office,
    district,
    state,
    incumbentChallenger,
    totalRaised: Math.round(totalRaised * 100) / 100,
    totalFromPacs: Math.round(totalFromPacs * 100) / 100,
    totalFromIndividuals: Math.round(totalFromIndividuals * 100) / 100,
    donorCount: donors.length,
    topDonors,
    committeeId: committee.committee_id,
  };

  console.log(`    Total raised: $${totalRaised.toLocaleString()} (${donors.length} donors)`);

  return result;
}

/**
 * Format FEC candidate name from "LAST, FIRST MIDDLE" to "First Last"
 */
function formatCandidateName(fecName) {
  if (!fecName) return 'Unknown';

  // FEC names are like "SMITH, JOHN A" or "SMITH, JOHN"
  const parts = fecName.split(',');
  if (parts.length < 2) {
    // No comma — already in a different format, just title case it
    return titleCase(stripTitles(fecName.trim()));
  }

  const lastName = stripTitles(parts[0].trim());
  const firstMiddle = stripTitles(parts.slice(1).join(',').trim());

  // Remove suffixes like JR, SR, III, II, IV
  const suffixPattern = /\b(JR|SR|III|II|IV)\b\.?$/i;
  const cleanFirst = firstMiddle.replace(suffixPattern, '').trim();
  const suffix = firstMiddle.match(suffixPattern)?.[1] || '';

  const formatted = `${titleCase(cleanFirst)} ${titleCase(lastName)}${suffix ? ` ${suffix}` : ''}`;
  return formatted.trim();
}

/**
 * Strip honorifics and titles from a name part.
 * FEC data sometimes includes MR., MRS., MS., DR., HON., REV., etc.
 */
function stripTitles(namePart) {
  return namePart
    .replace(/\b(MR|MRS|MS|MISS|DR|HON|REV|SGT|CPT|MAJ|COL|GEN|SEN|REP)\b\.?\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function titleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .filter(w => w.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export { RateLimitExhaustedError };
