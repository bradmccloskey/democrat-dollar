#!/usr/bin/env node

import dotenv from 'dotenv';
import {
  initFirebase,
  getAllCompanies,
  normalizeName,
} from './firebase-push.js';

dotenv.config();

const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');

async function auditCompanies(db) {
  console.log('\n' + '='.repeat(70));
  console.log('COMPANY AUDIT');
  console.log('='.repeat(70));

  const companies = await getAllCompanies();
  console.log(`Total company documents in Firestore: ${companies.length}`);

  // --- Detect duplicates by normalized name ---
  const byNormalized = new Map();
  for (const company of companies) {
    const key = normalizeName(company.name || company.id);
    if (!byNormalized.has(key)) {
      byNormalized.set(key, []);
    }
    byNormalized.get(key).push(company);
  }

  const duplicateGroups = [...byNormalized.entries()]
    .filter(([, group]) => group.length > 1);

  console.log(`\nDuplicate company groups (by normalized name): ${duplicateGroups.length}`);
  for (const [normalizedName, group] of duplicateGroups) {
    console.log(`\n  "${normalizedName}" has ${group.length} documents:`);
    for (const c of group) {
      const updated = c.lastUpdated?._seconds
        ? new Date(c.lastUpdated._seconds * 1000).toISOString()
        : c.lastUpdated || 'unknown';
      console.log(`    - id="${c.id}" name="${c.name}" category=${c.category} updated=${updated}`);
    }
  }

  // --- Detect cross-tab companies (appear as both support AND avoid) ---
  const supportNames = new Set();
  const avoidNames = new Set();
  for (const company of companies) {
    const key = normalizeName(company.name || company.id);
    if (company.category === 'support') supportNames.add(key);
    if (company.category === 'avoid') avoidNames.add(key);
  }

  const crossTab = [...supportNames].filter(name => avoidNames.has(name));
  console.log(`\nCross-tab companies (both support AND avoid): ${crossTab.length}`);
  for (const name of crossTab) {
    const group = byNormalized.get(name);
    console.log(`  "${name}":`);
    for (const c of group) {
      console.log(`    - id="${c.id}" category=${c.category}`);
    }
  }

  // --- Category distribution ---
  const categories = {};
  for (const company of companies) {
    categories[company.category] = (categories[company.category] || 0) + 1;
  }
  console.log('\nCategory distribution:');
  for (const [cat, count] of Object.entries(categories).sort()) {
    console.log(`  ${cat}: ${count}`);
  }

  return { companies, duplicateGroups, crossTab };
}

async function auditCandidates(db) {
  console.log('\n' + '='.repeat(70));
  console.log('CANDIDATE AUDIT');
  console.log('='.repeat(70));

  const snapshot = await db.collection('candidates').get();
  const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Total candidate documents in Firestore: ${candidates.length}`);

  // Count by state
  const byState = {};
  for (const c of candidates) {
    const state = c.state || 'UNKNOWN';
    byState[state] = (byState[state] || 0) + 1;
  }

  const stateCount = Object.keys(byState).length;
  console.log(`States with candidates: ${stateCount}`);
  for (const [state, count] of Object.entries(byState).sort()) {
    console.log(`  ${state}: ${count}`);
  }

  // Check metadata.candidateLastUpdate.stateCounts
  const metadataDoc = await db.collection('metadata').doc('candidateLastUpdate').get();
  if (metadataDoc.exists) {
    const metadata = metadataDoc.data();
    const stateCounts = metadata.stateCounts || {};
    console.log(`\nMetadata stateCounts entries: ${Object.keys(stateCounts).length}`);

    // Compare metadata counts with actual counts
    let mismatches = 0;
    const allStates = new Set([...Object.keys(byState), ...Object.keys(stateCounts)]);
    for (const state of [...allStates].sort()) {
      const actual = byState[state] || 0;
      const recorded = stateCounts[state] || 0;
      if (actual !== recorded) {
        console.log(`  MISMATCH ${state}: actual=${actual} metadata=${recorded}`);
        mismatches++;
      }
    }
    if (mismatches === 0) {
      console.log('  All state counts match metadata.');
    }
  } else {
    console.log('\nWARNING: metadata/candidateLastUpdate document does not exist!');
  }

  return { candidates, byState };
}

async function fixDuplicates(db, duplicateGroups) {
  console.log('\n' + '='.repeat(70));
  console.log('FIXING DUPLICATES');
  console.log('='.repeat(70));

  let totalDeleted = 0;

  for (const [normalizedName, group] of duplicateGroups) {
    // Keep the most recently updated document, delete the rest
    const sorted = group.sort((a, b) => {
      const aTime = a.lastUpdated?._seconds || 0;
      const bTime = b.lastUpdated?._seconds || 0;
      return bTime - aTime; // newest first
    });

    const keep = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`\n  "${normalizedName}": keeping id="${keep.id}", deleting ${toDelete.length} duplicates`);

    for (const dup of toDelete) {
      console.log(`    Deleting id="${dup.id}" (category=${dup.category})`);
      await db.collection('companies').doc(dup.id).delete();
      totalDeleted++;
    }
  }

  console.log(`\nTotal duplicates deleted: ${totalDeleted}`);
  return totalDeleted;
}

async function main() {
  console.log('DemocratDollar Firestore Data Audit');
  console.log(`Mode: ${shouldFix ? 'AUDIT + FIX' : 'AUDIT ONLY'}`);

  if (!process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_PATH environment variable not set');
    process.exit(1);
  }

  const db = initFirebase();

  const { duplicateGroups, crossTab } = await auditCompanies(db);
  const { candidates, byState } = await auditCandidates(db);

  // --- Summary ---
  console.log('\n' + '='.repeat(70));
  console.log('AUDIT SUMMARY');
  console.log('='.repeat(70));
  console.log(`Duplicate company groups: ${duplicateGroups.length}`);
  console.log(`Cross-tab companies: ${crossTab.length}`);
  console.log(`Total candidates: ${candidates.length}`);
  console.log(`States with candidates: ${Object.keys(byState).length}`);

  if (shouldFix && duplicateGroups.length > 0) {
    await fixDuplicates(db, duplicateGroups);
  } else if (duplicateGroups.length > 0) {
    console.log('\nRun with --fix to delete duplicate company documents.');
  }

  const hasIssues = duplicateGroups.length > 0 || crossTab.length > 0;
  if (!hasIssues) {
    console.log('\nAll checks passed — data is clean.');
  }

  process.exit(hasIssues && !shouldFix ? 1 : 0);
}

main().catch(error => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
