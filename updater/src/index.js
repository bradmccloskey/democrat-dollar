#!/usr/bin/env node

import { writeFileSync, mkdirSync } from 'fs';
import dotenv from 'dotenv';
import {
  getTrackedCompanies,
  searchCommittee,
  fetchDisbursements,
  getCompanyRank,
} from './fec-client.js';
import { RateLimitExhaustedError } from './fec-api.js';
import {
  categorizeCompany,
  calculateAggregateStats,
  sortCompanies
} from './categorize.js';
import {
  initFirebase,
  pushCompany,
  updateMetadata
} from './firebase-push.js';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const companyFlag = args.indexOf('--company');
const specificCompany = companyFlag !== -1 ? args[companyFlag + 1] : null;

// Configuration
const TWO_YEAR_PERIOD = 2024; // Current election cycle

/**
 * Process a single company
 */
async function processCompany(companyName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${companyName}`);
  console.log('='.repeat(60));

  const rank = getCompanyRank(companyName);

  try {
    // Step 1: Search for the committee
    const committee = await searchCommittee(companyName);

    if (!committee) {
      console.log(`  No committee found for ${companyName}`);
      return {
        name: companyName,
        category: 'none',
        hasPac: false,
        rank,
        industry: (await import('./fec-client.js')).getCompanyIndustry(companyName),
        totalDemocrat: 0,
        totalRepublican: 0,
        totalOther: 0,
        totalContributions: 0,
        percentDemocrat: 0,
        percentRepublican: 0,
        fecCommitteeIds: [],
        disbursementCount: 0,
      };
    }

    console.log(`  Found committee: ${committee.name} (${committee.committee_id})`);

    // Step 2: Fetch disbursements
    const disbursements = await fetchDisbursements(committee.committee_id, TWO_YEAR_PERIOD);

    if (disbursements.length === 0) {
      console.log(`  No disbursements found for ${companyName}`);
      return {
        name: companyName,
        category: 'none',
        hasPac: true,
        rank,
        industry: (await import('./fec-client.js')).getCompanyIndustry(companyName),
        totalDemocrat: 0,
        totalRepublican: 0,
        totalOther: 0,
        totalContributions: 0,
        percentDemocrat: 0,
        percentRepublican: 0,
        fecCommitteeIds: [committee.committee_id],
        disbursementCount: 0,
      };
    }

    // Step 3: Categorize
    const categorized = await categorizeCompany(
      companyName,
      disbursements,
      [committee.committee_id]
    );

    // Add rank from Fortune 500 data
    categorized.rank = rank;

    return categorized;

  } catch (error) {
    if (error instanceof RateLimitExhaustedError) {
      console.error(`  ${error.message}`);
      return { name: companyName, error: error.message, category: 'error', rateLimitExhausted: true };
    }
    console.error(`  Error processing ${companyName}:`, error.message);
    return {
      name: companyName,
      error: error.message,
      category: 'error'
    };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('DemocratDollar FEC Data Pipeline');
  console.log('='.repeat(70));
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log(`Two-year period: ${TWO_YEAR_PERIOD}`);
  console.log(`Dry run: ${isDryRun}`);

  if (specificCompany) {
    console.log(`Processing single company: ${specificCompany}`);
  }

  console.log('='.repeat(70));

  // Validate environment variables
  if (!process.env.FEC_API_KEY) {
    console.error('\nERROR: FEC_API_KEY environment variable not set');
    console.error('Please create a .env file with your FEC API key');
    process.exit(1);
  }

  if (!isDryRun && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.error('\nERROR: FIREBASE_SERVICE_ACCOUNT_PATH environment variable not set');
    console.error('Please set the path to your Firebase service account JSON file');
    process.exit(1);
  }

  // Initialize Firebase (unless dry run)
  if (!isDryRun) {
    try {
      initFirebase();
    } catch (error) {
      console.error('\nFailed to initialize Firebase:', error.message);
      process.exit(1);
    }
  }

  // Get list of companies to process
  let companiesToProcess = getTrackedCompanies();

  if (specificCompany) {
    if (companiesToProcess.includes(specificCompany)) {
      companiesToProcess = [specificCompany];
    } else {
      console.error(`\nERROR: Company "${specificCompany}" not found in tracked companies list`);
      console.error('Available companies:', companiesToProcess.slice(0, 10).join(', '), '...');
      process.exit(1);
    }
  }

  console.log(`\nProcessing ${companiesToProcess.length} companies...`);

  // Process all companies
  const results = [];
  let successCount = 0;
  let noPacCount = 0;
  let fatalErrorCount = 0;
  let rateLimitHit = false;

  for (const companyName of companiesToProcess) {
    const result = await processCompany(companyName);
    results.push(result);

    if (result.rateLimitExhausted) {
      rateLimitHit = true;
      console.error('\n** Rate limit exhausted — stopping early **');
      console.error('Get a real FEC API key at https://api.data.gov/signup');
      console.error(`Processed ${results.length} of ${companiesToProcess.length} companies before hitting limit.\n`);
      break;
    }

    if (result.error) {
      fatalErrorCount++;
    } else if (result.category === 'none') {
      noPacCount++;
    } else {
      successCount++;
    }

    // Push each company to Firebase immediately so live app gets data incrementally
    if (!isDryRun && !result.error && result.category !== 'error') {
      try {
        await pushCompany(result);
      } catch (pushError) {
        console.error(`  Failed to push ${companyName} to Firebase:`, pushError.message);
      }
    }
  }

  // Include both categorized AND no-PAC companies in valid results
  const validResults = results.filter(r => !r.error && r.category !== 'error');
  const categorizedResults = validResults.filter(r => r.category !== 'none');
  const stats = calculateAggregateStats(categorizedResults);

  // Sort companies
  const sortedResults = sortCompanies(categorizedResults);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total companies processed: ${results.length}`);
  console.log(`Successfully categorized: ${successCount}`);
  console.log(`No PAC / No data: ${noPacCount}`);
  console.log(`Errors: ${fatalErrorCount}`);
  console.log();
  console.log('By Category:');
  console.log(`  Support (Democrat-friendly): ${stats.support}`);
  console.log(`  Avoid (Republican-leaning): ${stats.avoid}`);
  console.log(`  Mixed (No clear lean): ${stats.mixed}`);
  console.log();
  console.log('By Industry:');
  for (const [industry, counts] of Object.entries(stats.byIndustry)) {
    console.log(`  ${industry}: ${counts.total} (${counts.support} support, ${counts.avoid} avoid, ${counts.mixed} mixed)`);
  }

  // Print top companies in each category
  console.log('\n' + '='.repeat(70));
  console.log('TOP COMPANIES BY CATEGORY');
  console.log('='.repeat(70));

  const supportCompanies = sortedResults.filter(c => c.category === 'support').slice(0, 10);
  const avoidCompanies = sortedResults.filter(c => c.category === 'avoid').slice(0, 10);

  console.log('\nTop 10 Democrat-Friendly (SUPPORT):');
  for (const company of supportCompanies) {
    console.log(`  ${company.name}: ${company.percentDemocrat.toFixed(1)}% DEM ($${company.totalDemocrat.toLocaleString()})`);
  }

  console.log('\nTop 10 Republican-Leaning (AVOID):');
  for (const company of avoidCompanies) {
    console.log(`  ${company.name}: ${company.percentRepublican.toFixed(1)}% REP ($${company.totalRepublican.toLocaleString()})`);
  }

  // Update metadata (companies were already pushed incrementally above)
  if (!isDryRun && validResults.length > 0) {
    try {
      console.log('\n' + '='.repeat(70));
      await updateMetadata(validResults.length);
      console.log('='.repeat(70));
    } catch (error) {
      console.error('\nFailed to update metadata:', error.message);
      process.exit(1);
    }
  } else if (isDryRun) {
    console.log('\n' + '='.repeat(70));
    console.log('DRY RUN - Skipping Firebase push');
    console.log('='.repeat(70));
  }

  // Print errors if any
  if (fatalErrorCount > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('ERRORS');
    console.log('='.repeat(70));
    for (const result of results.filter(r => r.error)) {
      console.log(`  ${result.name}: ${result.error}`);
    }
  }

  // Write actual count for run-update.sh notification
  mkdirSync('logs', { recursive: true });
  writeFileSync('logs/company-count.txt', String(validResults.length));

  console.log('\n' + '='.repeat(70));
  console.log(`End time: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  // Exit with error code only for actual failures or rate limit exhaustion
  if (fatalErrorCount > 0 || rateLimitHit) {
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
