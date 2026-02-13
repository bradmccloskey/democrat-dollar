#!/usr/bin/env node

import dotenv from 'dotenv';
import {
  fetchWakeCountyCandidates,
  processCandidate,
  RateLimitExhaustedError
} from './candidate-fetcher.js';
import {
  initFirebase,
  pushAllCandidates
} from './firebase-push.js';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('DemocratDollar Candidate Data Pipeline');
  console.log('='.repeat(70));
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log(`Region: Wake County, NC`);
  console.log(`Dry run: ${isDryRun}`);
  console.log('='.repeat(70));

  // Validate environment variables
  if (!process.env.FEC_API_KEY) {
    console.error('\nERROR: FEC_API_KEY environment variable not set');
    process.exit(1);
  }

  if (!isDryRun && !process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.error('\nERROR: FIREBASE_SERVICE_ACCOUNT_PATH environment variable not set');
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

  // Step 1: Fetch all Wake County candidates from FEC
  let fecCandidates;
  try {
    fecCandidates = await fetchWakeCountyCandidates();
  } catch (error) {
    if (error instanceof RateLimitExhaustedError) {
      console.error(`\n${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  if (fecCandidates.length === 0) {
    console.log('\nNo candidates found. Exiting.');
    process.exit(0);
  }

  // Step 2: Process each candidate (fetch committees, contributions, aggregate donors)
  console.log('\n' + '='.repeat(70));
  console.log(`Processing ${fecCandidates.length} candidates...`);
  console.log('='.repeat(70));

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  for (const fecCandidate of fecCandidates) {
    try {
      const result = await processCandidate(fecCandidate);
      results.push(result);

      if (result.error) {
        errorCount++;
      } else {
        successCount++;
      }
    } catch (error) {
      if (error instanceof RateLimitExhaustedError) {
        console.error('\n** Rate limit exhausted — stopping early **');
        console.error(`Processed ${results.length} of ${fecCandidates.length} candidates before hitting limit.\n`);
        break;
      }
      console.error(`  Error processing candidate:`, error.message);
      errorCount++;
    }
  }

  // Step 3: Print summary
  const validResults = results.filter(r => !r.error && r.totalRaised > 0);

  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total candidates processed: ${results.length}`);
  console.log(`With data: ${validResults.length}`);
  console.log(`Errors/no data: ${errorCount}`);

  // Group by office
  const byOffice = {};
  for (const candidate of validResults) {
    const office = candidate.office;
    if (!byOffice[office]) byOffice[office] = [];
    byOffice[office].push(candidate);
  }

  console.log('\nBy Office:');
  for (const [office, candidates] of Object.entries(byOffice)) {
    console.log(`\n  ${office} (${candidates.length} candidates):`);
    const sorted = candidates.sort((a, b) => b.totalRaised - a.totalRaised);
    for (const c of sorted) {
      const partyLabel = c.party === 'DEM' ? 'D' : c.party === 'REP' ? 'R' : c.party;
      console.log(`    ${c.name} (${partyLabel}) - $${c.totalRaised.toLocaleString()} raised, ${c.donorCount} donors`);
    }
  }

  // Step 4: Push to Firebase
  if (!isDryRun && validResults.length > 0) {
    try {
      console.log('\n' + '='.repeat(70));
      await pushAllCandidates(validResults);
      console.log('='.repeat(70));
    } catch (error) {
      console.error('\nFailed to push to Firebase:', error.message);
      process.exit(1);
    }
  } else if (isDryRun) {
    console.log('\n' + '='.repeat(70));
    console.log('DRY RUN - Skipping Firebase push');
    console.log('='.repeat(70));
  }

  console.log('\n' + '='.repeat(70));
  console.log(`End time: ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
