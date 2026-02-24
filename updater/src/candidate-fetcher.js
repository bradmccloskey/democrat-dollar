import { FEC_API_BASE, API_KEY, rateLimitedFetch, RateLimitExhaustedError } from './fec-api.js';
import { getAllJurisdictions, getDistrictsForState, getStateName } from './states.js';

// Election cycles to search
const ELECTION_CYCLES = [2024, 2026];

/**
 * Search for federal candidates by office type, state, and district.
 * office: H (House), S (Senate), P (President)
 * state: two-letter code (omit for Presidential)
 * district: two-digit string (only for House)
 */
async function searchFederalCandidates(office, state = null, district = null) {
  const candidates = [];

  for (const cycle of ELECTION_CYCLES) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      let url = `${FEC_API_BASE}/candidates/search/?api_key=${API_KEY}&office=${office}&cycle=${cycle}&is_active_candidate=true&per_page=100&page=${page}&sort=name`;

      if (state) {
        url += `&state=${state}`;
      }

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
        console.warn(`  Error searching ${office} candidates (${state || 'US'}, cycle ${cycle}, page ${page}):`, error.message);
        hasMore = false;
      }
    }
  }

  return candidates;
}

/**
 * Normalize a candidate name for deduplication comparison.
 * Strips suffixes (Jr, Sr, III), titles, and normalizes whitespace.
 */
function normalizeCandidateName(name) {
  return (name || '')
    .toUpperCase()
    .replace(/,/g, ' ')
    .replace(/\b(JR|SR|III|II|IV|MR|MRS|MS|DR|HON|REV|SEN|REP)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplicate candidates by normalized name.
 * When the same person appears multiple times (different FEC IDs from different
 * cycles/offices), keep the one with the most recent election cycle.
 */
function deduplicateByName(candidates) {
  const byName = new Map();

  for (const c of candidates) {
    const key = normalizeCandidateName(c.name);
    if (!byName.has(key)) {
      byName.set(key, c);
    } else {
      const existing = byName.get(key);
      // Prefer the candidate with the most recent cycle
      const existingCycles = existing.cycles || [];
      const currentCycles = c.cycles || [];
      const existingMax = existingCycles.length > 0 ? Math.max(...existingCycles) : 0;
      const currentMax = currentCycles.length > 0 ? Math.max(...currentCycles) : 0;
      if (currentMax > existingMax) {
        byName.set(key, c);
      }
    }
  }

  return Array.from(byName.values());
}

/**
 * Fetch all candidates for a single state (Senate + all House districts).
 */
export async function fetchCandidatesForState(stateCode) {
  const stateName = getStateName(stateCode);
  console.log(`\nFetching candidates for ${stateName} (${stateCode})...`);
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

  // Senate candidates (statewide)
  console.log(`  Searching ${stateCode} Senate candidates...`);
  const senateCandidates = await searchFederalCandidates('S', stateCode);
  console.log(`    Found ${senateCandidates.length} Senate candidates`);
  addUnique(senateCandidates);

  // House candidates for all districts
  const districts = getDistrictsForState(stateCode);
  for (const district of districts) {
    console.log(`  Searching ${stateCode} House District ${district} candidates...`);
    const houseCandidates = await searchFederalCandidates('H', stateCode, district);
    console.log(`    Found ${houseCandidates.length} House-${district} candidates`);
    addUnique(houseCandidates);
  }

  console.log(`  Total unique candidates (by ID) for ${stateCode}: ${allCandidates.length}`);

  // Deduplicate by normalized name — same person may have multiple FEC IDs
  // (different cycles/offices). Keep the one with the most recent cycle.
  const deduped = deduplicateByName(allCandidates);
  if (deduped.length < allCandidates.length) {
    console.log(`  Deduplicated by name: ${allCandidates.length} → ${deduped.length} (removed ${allCandidates.length - deduped.length} duplicates)`);
  }

  return deduped;
}

/**
 * Fetch Presidential candidates (no state filter).
 */
export async function fetchPresidentialCandidates() {
  console.log('\nFetching Presidential candidates...');
  const candidates = await searchFederalCandidates('P');
  console.log(`  Found ${candidates.length} Presidential candidates`);
  return candidates;
}

/**
 * Fetch all nationwide candidates across all states + Presidential.
 * options.states — array of state codes to process (null = all)
 * options.skipPresidential — skip presidential candidates
 * options.onStateComplete — callback(stateCode, candidates) after each state
 */
export async function fetchAllNationwideCandidates(options = {}) {
  const {
    states: requestedStates = null,
    skipPresidential = false,
    onStateComplete = null,
  } = options;

  const jurisdictions = getAllJurisdictions();
  const statesToProcess = requestedStates
    ? jurisdictions.filter(j => requestedStates.includes(j.code))
    : jurisdictions;

  const allCandidates = [];
  const stateCounts = {};

  // Presidential candidates (once, not per-state)
  if (!skipPresidential && !requestedStates) {
    const presidential = await fetchPresidentialCandidates();
    allCandidates.push(...presidential);
  }

  // Per-state candidates
  const total = statesToProcess.length;
  for (let i = 0; i < statesToProcess.length; i++) {
    const { code } = statesToProcess[i];
    console.log(`\n[${i + 1}/${total}] Processing ${getStateName(code)} (${code})...`);

    const stateCandidates = await fetchCandidatesForState(code);
    allCandidates.push(...stateCandidates);
    stateCounts[code] = stateCandidates.length;

    if (onStateComplete) {
      await onStateComplete(code, stateCandidates);
    }
  }

  return { candidates: allCandidates, stateCounts };
}

/**
 * Fetch the principal campaign committee for a candidate.
 */
async function fetchCandidateCommittee(candidateId) {
  try {
    const url = `${FEC_API_BASE}/candidate/${candidateId}/committees/?api_key=${API_KEY}&designation=P&per_page=5`;
    const data = await rateLimitedFetch(url);

    if (data.results && data.results.length > 0) {
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
      return data.results[0];
    }
  } catch (error) {
    console.warn(`  Could not fetch totals for ${candidateId}:`, error.message);
  }
  return null;
}

/**
 * Fetch Schedule A (contributions received) for a committee.
 */
async function fetchContributions(committeeId, limit = 500) {
  const allContributions = [];
  let lastIndex = null;
  let lastContributionDate = null;

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

        if (pagesFetched >= 5) break;
      } catch (error) {
        console.warn(`    Error fetching contributions for ${committeeId} (${period}):`, error.message);
        break;
      }
    }

    lastIndex = null;
    lastContributionDate = null;
  }

  return allContributions;
}

/**
 * Aggregate contributions by donor.
 */
function aggregateDonors(contributions) {
  const donorMap = new Map();

  for (const contribution of contributions) {
    const amount = parseFloat(contribution.contribution_receipt_amount) || 0;
    if (amount <= 0) continue;

    const committeeType = contribution.contributor_committee_type;
    const entityType = contribution.entity_type;

    let donorName;
    let donorType;

    if (committeeType || entityType === 'COM' || entityType === 'PAC' || entityType === 'ORG') {
      donorName = contribution.contributor_name || contribution.committee_name || 'Unknown PAC';
      donorType = 'pac';
    } else if (entityType === 'IND' || !entityType) {
      donorName = contribution.contributor_name || 'Unknown Individual';
      donorType = 'individual';
    } else {
      donorName = contribution.contributor_name || 'Unknown';
      donorType = 'other';
    }

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

  return Array.from(donorMap.values())
    .sort((a, b) => b.totalAmount - a.totalAmount);
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
    officeLabel = `US House ${state}-${district}`;
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

  // Calculate totals
  const totalFromPacs = donors
    .filter(d => d.type === 'pac')
    .reduce((sum, d) => sum + d.totalAmount, 0);
  const totalFromIndividuals = donors
    .filter(d => d.type === 'individual')
    .reduce((sum, d) => sum + d.totalAmount, 0);
  const totalFromOther = donors
    .filter(d => d.type === 'other')
    .reduce((sum, d) => sum + d.totalAmount, 0);

  const totalRaised = totals?.receipts || (totalFromPacs + totalFromIndividuals + totalFromOther);

  // Keep top 50 donors for detail view
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

  const parts = fecName.split(',');
  if (parts.length < 2) {
    return titleCase(stripTitles(fecName.trim()));
  }

  const lastName = stripTitles(parts[0].trim());
  const firstMiddle = stripTitles(parts.slice(1).join(',').trim());

  const suffixPattern = /\b(JR|SR|III|II|IV)\b\.?$/i;
  const cleanFirst = firstMiddle.replace(suffixPattern, '').trim();
  const suffix = firstMiddle.match(suffixPattern)?.[1] || '';

  const formatted = `${titleCase(cleanFirst)} ${titleCase(lastName)}${suffix ? ` ${suffix}` : ''}`;
  return formatted.trim();
}

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

export { RateLimitExhaustedError } from './fec-api.js';
