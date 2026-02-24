#!/usr/bin/env node

/**
 * One-time script to rebuild metadata.candidateLastUpdate.stateCounts
 * from actual Firebase candidate data.
 *
 * Usage: node src/rebuild-metadata.js [--dry-run]
 */

import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { initFirebase } from './firebase-push.js';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log('Rebuild Candidate Metadata — stateCounts');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_PATH not set');
    process.exit(1);
  }

  const db = initFirebase();

  // Read all candidates
  console.log('\nReading all candidates from Firestore...');
  const snapshot = await db.collection('candidates').get();
  const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Total candidates: ${candidates.length}`);

  // Count per state
  const stateCounts = {};
  for (const c of candidates) {
    const state = c.state;
    if (state) {
      stateCounts[state] = (stateCounts[state] || 0) + 1;
    }
  }

  const stateCount = Object.keys(stateCounts).length;
  console.log(`\nStates with candidates: ${stateCount}`);
  for (const [state, count] of Object.entries(stateCounts).sort()) {
    console.log(`  ${state}: ${count}`);
  }

  const totalFromCounts = Object.values(stateCounts).reduce((a, b) => a + b, 0);
  console.log(`\nTotal from state counts: ${totalFromCounts}`);

  if (isDryRun) {
    console.log('\nDry run — no changes written.');
    process.exit(0);
  }

  // Write accurate stateCounts to metadata
  console.log('\nWriting stateCounts to metadata.candidateLastUpdate...');
  const metadataRef = db.collection('metadata').doc('candidateLastUpdate');
  await metadataRef.set({
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
    stateCounts,
  });

  console.log('Metadata updated successfully.');
  console.log(`  ${stateCount} states, ${candidates.length} total candidates`);
  process.exit(0);
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
