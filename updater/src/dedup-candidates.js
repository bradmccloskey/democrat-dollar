#!/usr/bin/env node

/**
 * One-time script to remove duplicate candidates from Firebase.
 * Groups by state + normalized name, keeps the candidate with the
 * highest totalRaised, deletes the rest.
 *
 * Usage: node src/dedup-candidates.js [--dry-run]
 */

import dotenv from 'dotenv';
import { initFirebase } from './firebase-push.js';

dotenv.config();

const isDryRun = process.argv.includes('--dry-run');

function normalizeName(name) {
  return (name || '')
    .toUpperCase()
    .replace(/\b(JR|SR|III|II|IV)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('Deduplicate Candidates in Firebase');
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

  // Group by state + normalized name
  const groups = new Map();
  for (const c of candidates) {
    const key = (c.state || 'UNKNOWN') + ':' + normalizeName(c.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  // Find duplicate groups
  const dupeGroups = [...groups.entries()].filter(([, g]) => g.length > 1);
  console.log(`\nDuplicate groups found: ${dupeGroups.length}`);

  if (dupeGroups.length === 0) {
    console.log('No duplicates to clean up.');
    process.exit(0);
  }

  let totalToDelete = 0;
  const toDelete = [];

  for (const [key, group] of dupeGroups) {
    // Sort by totalRaised descending — keep the richest record
    group.sort((a, b) => (b.totalRaised || 0) - (a.totalRaised || 0));
    const keep = group[0];
    const remove = group.slice(1);

    console.log(`\n  ${key} (${group.length} entries):`);
    console.log(`    KEEP: id=${keep.id} office="${keep.office}" raised=$${(keep.totalRaised || 0).toLocaleString()}`);
    for (const r of remove) {
      console.log(`    DELETE: id=${r.id} office="${r.office}" raised=$${(r.totalRaised || 0).toLocaleString()}`);
      toDelete.push(r.id);
    }

    totalToDelete += remove.length;
  }

  console.log(`\nTotal candidates to delete: ${totalToDelete}`);

  if (isDryRun) {
    console.log('\nDry run — no changes made.');
    process.exit(0);
  }

  // Delete duplicates in batches
  console.log('\nDeleting duplicates...');
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batchCount = 0;
  let deleted = 0;

  for (const docId of toDelete) {
    batch.delete(db.collection('candidates').doc(docId));
    batchCount++;
    deleted++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch (${deleted}/${totalToDelete})`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\nDeleted ${deleted} duplicate candidates.`);
  console.log('Run `node src/rebuild-metadata.js` next to update state counts.');
  process.exit(0);
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
