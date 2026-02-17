#!/usr/bin/env node

import dotenv from 'dotenv';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import {
  fetchCandidatesForState,
  fetchPresidentialCandidates,
  processCandidate,
  RateLimitExhaustedError
} from './candidate-fetcher.js';
import { getAllJurisdictions, getStateName } from './states.js';
import {
  initFirebase,
  pushCandidatesForState,
  pushPresidentialCandidates
} from './firebase-push.js';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isResume = args.includes('--resume');
const presidentialOnly = args.includes('--presidential-only');

// Parse --state NC,VA,CA
const stateFlag = args.indexOf('--state');
const requestedStates = stateFlag !== -1
  ? args[stateFlag + 1]?.split(',').map(s => s.trim().toUpperCase())
  : null;

const PROGRESS_FILE = 'logs/candidate-progress.json';

function loadProgress() {
  try {
    if (existsSync(PROGRESS_FILE)) {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Could not load progress file:', e.message);
  }
  return { completedStates: [], startedAt: new Date().toISOString() };
}

function saveProgress(progress) {
  try {
    mkdirSync('logs', { recursive: true });
    writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (e) {
    console.warn('Could not save progress:', e.message);
  }
}

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('DemocratDollar Candidate Data Pipeline — Nationwide');
  console.log('='.repeat(70));
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log(`Resume: ${isResume}`);
  if (requestedStates) console.log(`States: ${requestedStates.join(', ')}`);
  if (presidentialOnly) console.log('Mode: Presidential only');
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

  // Load progress for resume mode
  const progress = isResume ? loadProgress() : { completedStates: [], startedAt: new Date().toISOString() };
  const completedSet = new Set(progress.completedStates);

  // Presidential candidates
  let totalCandidatesPushed = 0;

  if (presidentialOnly || (!requestedStates && !completedSet.has('_presidential'))) {
    try {
      console.log('\n' + '='.repeat(70));
      console.log('PRESIDENTIAL CANDIDATES');
      console.log('='.repeat(70));

      const fecCandidates = await fetchPresidentialCandidates();
      const results = await processCandidateList(fecCandidates);
      const validResults = results.filter(r => !r.error && r.totalRaised > 0);

      if (!isDryRun && validResults.length > 0) {
        await pushPresidentialCandidates(validResults);
        console.log(`  Pushed ${validResults.length} presidential candidates`);
      }

      totalCandidatesPushed += validResults.length;
      completedSet.add('_presidential');
      progress.completedStates = [...completedSet];
      saveProgress(progress);
    } catch (error) {
      if (error instanceof RateLimitExhaustedError) {
        console.error('\n** Rate limit exhausted during presidential fetch **');
        saveProgress(progress);
        process.exit(1);
      }
      console.error('Error fetching presidential candidates:', error.message);
    }

    if (presidentialOnly) {
      printSummary(totalCandidatesPushed);
      return;
    }
  }

  // Determine which states to process
  const jurisdictions = getAllJurisdictions();
  let statesToProcess = requestedStates
    ? jurisdictions.filter(j => requestedStates.includes(j.code))
    : jurisdictions;

  // Skip already-completed states in resume mode
  if (isResume) {
    const before = statesToProcess.length;
    statesToProcess = statesToProcess.filter(j => !completedSet.has(j.code));
    if (before > statesToProcess.length) {
      console.log(`\nResuming: skipping ${before - statesToProcess.length} already-completed states`);
    }
  }

  const total = statesToProcess.length;
  const stateCounts = {};

  for (let i = 0; i < statesToProcess.length; i++) {
    const { code } = statesToProcess[i];
    const stateName = getStateName(code);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`[${i + 1}/${total}] Processing ${stateName} (${code})...`);
    console.log('='.repeat(70));

    try {
      // Fetch candidates for this state
      const fecCandidates = await fetchCandidatesForState(code);

      if (fecCandidates.length === 0) {
        console.log(`  No candidates found for ${code}`);
        stateCounts[code] = 0;
        completedSet.add(code);
        progress.completedStates = [...completedSet];
        saveProgress(progress);
        continue;
      }

      // Process each candidate
      const results = await processCandidateList(fecCandidates);
      const validResults = results.filter(r => !r.error && r.totalRaised > 0);

      // Push to Firebase per-state
      if (!isDryRun && validResults.length > 0) {
        await pushCandidatesForState(code, validResults);
      }

      stateCounts[code] = validResults.length;
      totalCandidatesPushed += validResults.length;

      console.log(`  [${i + 1}/${total}] ${stateName} (${code}): ${validResults.length} candidates pushed`);

      // Save progress after each state
      completedSet.add(code);
      progress.completedStates = [...completedSet];
      progress.stateCounts = { ...progress.stateCounts, ...stateCounts };
      saveProgress(progress);

    } catch (error) {
      if (error instanceof RateLimitExhaustedError) {
        console.error(`\n** Rate limit exhausted during ${code} — saving progress **`);
        saveProgress(progress);
        process.exit(1);
      }
      console.error(`  Error processing ${code}:`, error.message);
    }
  }

  // Write actual count for run-update.sh notification
  writeFileSync('logs/candidate-count.txt', String(totalCandidatesPushed));

  printSummary(totalCandidatesPushed, stateCounts);
}

/**
 * Process a list of FEC candidates (fetch committees, contributions, aggregate).
 */
async function processCandidateList(fecCandidates) {
  const results = [];

  for (const fecCandidate of fecCandidates) {
    try {
      const result = await processCandidate(fecCandidate);
      results.push(result);
    } catch (error) {
      if (error instanceof RateLimitExhaustedError) throw error;
      console.error(`  Error processing candidate:`, error.message);
    }
  }

  return results;
}

function printSummary(totalPushed, stateCounts = {}) {
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total candidates pushed: ${totalPushed}`);

  if (Object.keys(stateCounts).length > 0) {
    console.log('\nBy State:');
    for (const [code, count] of Object.entries(stateCounts).sort()) {
      console.log(`  ${code}: ${count} candidates`);
    }
  }

  console.log(`\nEnd time: ${new Date().toISOString()}`);
  console.log('='.repeat(70));
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
