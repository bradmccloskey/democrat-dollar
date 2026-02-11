import { getCandidateInfo, getCompanyIndustry, batchFetchCandidates } from './fec-client.js';

/**
 * Categorize a company based on their political disbursements
 *
 * @param {string} companyName - The display name of the company
 * @param {Array} disbursements - Array of FEC Schedule B disbursement records
 * @param {Array} committeeIds - Array of FEC committee IDs associated with this company
 * @returns {Object} Categorized company data
 */
export async function categorizeCompany(companyName, disbursements, committeeIds = []) {
  console.log(`Categorizing ${companyName} with ${disbursements.length} disbursements...`);

  const partyTotals = {
    DEM: 0,
    REP: 0,
    OTH: 0
  };

  // Collect all unique candidate IDs that need lookup
  const candidateIds = new Set();
  for (const d of disbursements) {
    if (d.candidate_id) candidateIds.add(d.candidate_id);
  }

  // Batch-fetch all candidate party info at once
  const candidateCache = await batchFetchCandidates([...candidateIds]);
  console.log(`  Resolved ${candidateCache.size} unique candidates`);

  // Process each disbursement
  for (const disbursement of disbursements) {
    const amount = Math.max(0, parseFloat(disbursement.disbursement_amount) || 0);
    let party = null;

    // Primary: use candidate_id to look up party from batch cache
    if (disbursement.candidate_id && candidateCache.has(disbursement.candidate_id)) {
      party = candidateCache.get(disbursement.candidate_id);
    }

    // Fallback: parse from recipient name
    if (!party && disbursement.recipient_name) {
      const name = disbursement.recipient_name.toUpperCase();
      if (name.includes('(D)') || name.includes('DEM')) {
        party = 'DEM';
      } else if (name.includes('(R)') || name.includes('REP')) {
        party = 'REP';
      }
    }

    // Categorize by party
    if (party === 'DEM') {
      partyTotals.DEM += amount;
    } else if (party === 'REP') {
      partyTotals.REP += amount;
    } else {
      partyTotals.OTH += amount;
    }
  }

  // Calculate totals and percentages
  const totalDemocrat = partyTotals.DEM;
  const totalRepublican = partyTotals.REP;
  const totalOther = partyTotals.OTH;
  const totalContributions = totalDemocrat + totalRepublican; // Exclude "other" from denominator

  let percentDemocrat = 0;
  let percentRepublican = 0;

  if (totalContributions > 0) {
    percentDemocrat = (totalDemocrat / totalContributions) * 100;
    percentRepublican = (totalRepublican / totalContributions) * 100;
  }

  // Determine category
  let category = 'mixed';
  if (percentDemocrat > 55) {
    category = 'support';
  } else if (percentRepublican > 55) {
    category = 'avoid';
  }

  // Get industry from mapping
  const industry = getCompanyIndustry(companyName);

  const result = {
    name: companyName,
    industry,
    totalDemocrat: Math.round(totalDemocrat * 100) / 100,
    totalRepublican: Math.round(totalRepublican * 100) / 100,
    totalOther: Math.round(totalOther * 100) / 100,
    totalContributions: Math.round(totalContributions * 100) / 100,
    percentDemocrat: Math.round(percentDemocrat * 10) / 10,
    percentRepublican: Math.round(percentRepublican * 10) / 10,
    category,
    fecCommitteeIds: committeeIds,
    disbursementCount: disbursements.length
  };

  console.log(`  ${companyName}: ${category.toUpperCase()} (${percentDemocrat.toFixed(1)}% DEM, ${percentRepublican.toFixed(1)}% REP)`);

  return result;
}

/**
 * Helper to extract candidate ID from committee ID
 * Candidate IDs typically start with H (House), S (Senate), or P (Presidential)
 * Committee IDs start with C
 */
function extractCandidateIdFromCommitteeId(committeeId) {
  // This is a heuristic - not all committee IDs can be easily mapped to candidate IDs
  // In practice, we'll rely on the candidate_id field or API lookups
  return null;
}

/**
 * Calculate aggregate statistics across all companies
 */
export function calculateAggregateStats(categorizedCompanies) {
  const stats = {
    total: categorizedCompanies.length,
    support: 0,
    avoid: 0,
    mixed: 0,
    byIndustry: {}
  };

  for (const company of categorizedCompanies) {
    // Count by category
    stats[company.category]++;

    // Count by industry
    if (!stats.byIndustry[company.industry]) {
      stats.byIndustry[company.industry] = {
        total: 0,
        support: 0,
        avoid: 0,
        mixed: 0
      };
    }

    stats.byIndustry[company.industry].total++;
    stats.byIndustry[company.industry][company.category]++;
  }

  return stats;
}

/**
 * Sort companies by category and percentage
 */
export function sortCompanies(companies) {
  const categoryOrder = { support: 1, mixed: 2, avoid: 3 };

  return companies.sort((a, b) => {
    // First sort by category
    if (categoryOrder[a.category] !== categoryOrder[b.category]) {
      return categoryOrder[a.category] - categoryOrder[b.category];
    }

    // Within category, sort by percentage
    if (a.category === 'support') {
      return b.percentDemocrat - a.percentDemocrat; // Highest DEM % first
    } else if (a.category === 'avoid') {
      return b.percentRepublican - a.percentRepublican; // Highest REP % first
    } else {
      return a.name.localeCompare(b.name); // Alphabetical for mixed
    }
  });
}
