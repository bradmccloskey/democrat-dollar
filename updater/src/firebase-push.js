import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

let firebaseInitialized = false;
let db = null;

/**
 * Initialize Firebase Admin SDK
 */
export function initFirebase() {
  if (firebaseInitialized) {
    console.log('Firebase already initialized');
    return db;
  }

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!serviceAccountPath) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH environment variable not set');
    }

    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    db = admin.firestore();
    firebaseInitialized = true;

    console.log('Firebase initialized successfully');
    return db;

  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    throw error;
  }
}

/**
 * Convert company name to a URL-friendly slug.
 * Strips common corporate suffixes (Inc, Corp, LLC, etc.) before slugifying
 * so that "D.R. Horton Inc" and "D.R. Horton" produce the same slug.
 */
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Strip common corporate suffixes
    .replace(/\b(inc\.?|corp\.?|corporation|llc|llp|co\.?|company|group|holdings?|enterprises?|international|intl\.?|ltd\.?|plc|n\.?a\.?|& co\.?)\s*$/i, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/&/g, '-and-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Normalize a company name for dedup comparison.
 * More aggressive than slugify — strips ALL corporate suffixes and punctuation.
 */
export function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[.,'"]/g, '')
    .replace(/\b(inc|corp|corporation|llc|llp|co|company|group|holdings?|enterprises?|international|intl|ltd|plc|the)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert a company data object to Firestore REST API field format.
 * Explicitly sets doubleValue for fields Swift expects as Double,
 * integerValue for Int fields, preventing type mismatch decode failures.
 */
const DOUBLE_FIELDS = new Set([
  'totalDemocrat', 'totalRepublican', 'totalOther', 'totalContributions',
  'percentDemocrat', 'percentRepublican',
  // Candidate fields Swift expects as Double
  'totalRaised', 'totalFromPacs', 'totalFromIndividuals', 'totalAmount'
]);

function toFirestoreFields(data) {
  const fields = {};
  for (const [key, val] of Object.entries(data)) {
    if (key === 'lastUpdated') continue;
    // Skip empty arrays — optional fields in Swift decode as nil when absent
    if (Array.isArray(val) && val.length === 0) continue;
    fields[key] = toFirestoreValue(key, val);
  }
  fields.lastUpdated = { timestampValue: new Date().toISOString() };
  return fields;
}

function toFirestoreValue(key, val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(v => toFirestoreValue(null, v)) } };
  }
  // Plain object (e.g., a Donor inside topDonors array) — recurse into fields
  if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
    const mapFields = {};
    for (const [k, v] of Object.entries(val)) {
      mapFields[k] = toFirestoreValue(k, v);
    }
    return { mapValue: { fields: mapFields } };
  }
  if (typeof val === 'number') {
    // Fields Swift expects as Double must be doubleValue
    if (DOUBLE_FIELDS.has(key)) return { doubleValue: val };
    // Everything else (rank, disbursementCount, donorCount, contributionCount) stays as integer
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  return { stringValue: String(val) };
}

let _accessToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
  const cred = admin.credential.cert(
    JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'))
  );
  const token = await cred.getAccessToken();
  _accessToken = token.access_token;
  _tokenExpiry = Date.now() + 50 * 60 * 1000; // refresh 10 min before expiry
  return _accessToken;
}

/**
 * Push a single company to Firestore via REST API for explicit type control.
 */
export async function pushCompany(companyData) {
  const companyId = slugify(companyData.name);
  const dataWithSlug = { ...companyData, slug: companyId };
  const fields = toFirestoreFields(dataWithSlug);
  const token = await getAccessToken();

  const url = `https://firestore.googleapis.com/v1/projects/democrat-dollar/databases/(default)/documents/companies/${companyId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore REST error ${response.status}: ${err}`);
  }

  console.log(`  Pushed ${companyData.name} to Firestore (${companyId})`);
  return companyId;
}

/**
 * Push all companies to Firestore via REST API (explicit type control).
 * Uses individual REST calls instead of SDK batches to ensure Double fields
 * are stored as doubleValue, not integerValue.
 */
export async function pushAllCompanies(companies) {
  console.log(`\nPushing ${companies.length} companies to Firestore via REST...`);

  let pushed = 0;
  for (const companyData of companies) {
    try {
      await pushCompany(companyData);
      pushed++;
    } catch (error) {
      console.error(`  Failed to push ${companyData.name}:`, error.message);
    }
  }

  console.log(`Successfully pushed ${pushed}/${companies.length} companies`);

  // Update metadata
  await updateMetadata(companies.length);

  return companies.length;
}

/**
 * Update metadata document with last update timestamp and count
 */
export async function updateMetadata(companyCount) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  try {
    const metadataRef = db.collection('metadata').doc('lastUpdate');

    await metadataRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      companyCount,
      updatedAt: new Date().toISOString()
    });

    console.log('Metadata updated successfully');
  } catch (error) {
    console.error('Failed to update metadata:', error.message);
    throw error;
  }
}

/**
 * Push a single candidate to Firestore via REST API for explicit type control.
 * Ensures totalRaised, totalFromPacs, totalFromIndividuals, and nested
 * topDonors[].totalAmount are stored as doubleValue.
 */
async function pushCandidateREST(candidateData) {
  const candidateId = slugify(candidateData.candidateId || candidateData.name);
  const dataWithSlug = { ...candidateData, slug: candidateId };
  const fields = toFirestoreFields(dataWithSlug);
  const token = await getAccessToken();

  const url = `https://firestore.googleapis.com/v1/projects/democrat-dollar/databases/(default)/documents/candidates/${candidateId}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore REST error ${response.status}: ${err}`);
  }

  return candidateId;
}

/**
 * Push candidates for a single state to Firestore.
 * Uses REST API for writes (explicit type control), SDK for stale deletes.
 */
export async function pushCandidatesForState(stateCode, candidates) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  console.log(`\nPushing ${candidates.length} candidates for ${stateCode} to Firestore via REST...`);

  // Get existing candidates for this state (for stale cleanup)
  const existingSnapshot = await db.collection('candidates')
    .where('state', '==', stateCode)
    .get();

  const existingIds = new Set(existingSnapshot.docs.map(doc => doc.id));
  const freshIds = new Set();

  // Push each candidate via REST for explicit type control
  let pushed = 0;
  for (const candidateData of candidates) {
    try {
      const candidateId = await pushCandidateREST(candidateData);
      freshIds.add(candidateId);
      pushed++;
    } catch (error) {
      console.error(`  Failed to push candidate ${candidateData.name}:`, error.message);
    }
  }

  // Delete stale candidates via SDK batch (type mapping irrelevant for deletes)
  const staleIds = [...existingIds].filter(id => !freshIds.has(id));
  if (staleIds.length > 0) {
    const BATCH_SIZE = 500;
    let batch = db.batch();
    let operationCount = 0;

    for (const oldId of staleIds) {
      batch.delete(db.collection('candidates').doc(oldId));
      operationCount++;
      console.log(`  Deleting stale candidate: ${oldId}`);

      if (operationCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }
  }

  console.log(`  Pushed ${pushed}/${candidates.length} candidates for ${stateCode}`);

  // Update candidate metadata with state counts
  await updateCandidateMetadataForState(stateCode, candidates.length);
}

/**
 * Push presidential candidates to Firestore via REST API.
 */
export async function pushPresidentialCandidates(candidates) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  console.log(`\nPushing ${candidates.length} presidential candidates to Firestore via REST...`);

  let pushed = 0;
  for (const candidateData of candidates) {
    try {
      await pushCandidateREST(candidateData);
      pushed++;
    } catch (error) {
      console.error(`  Failed to push presidential candidate ${candidateData.name}:`, error.message);
    }
  }

  console.log(`  Pushed ${pushed}/${candidates.length} presidential candidates`);
}

/**
 * Push all candidates to Firestore via REST (legacy — used for single-state runs)
 */
export async function pushAllCandidates(candidates) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  console.log(`\nPushing ${candidates.length} candidates to Firestore via REST...`);

  let pushed = 0;
  for (const candidateData of candidates) {
    try {
      await pushCandidateREST(candidateData);
      pushed++;
    } catch (error) {
      console.error(`  Failed to push ${candidateData.name}:`, error.message);
    }
  }

  console.log(`Successfully pushed ${pushed}/${candidates.length} candidates`);

  await updateCandidateMetadata(candidates.length);

  return candidates.length;
}

/**
 * Update candidate metadata with per-state counts (merge into existing doc)
 */
async function updateCandidateMetadataForState(stateCode, count) {
  if (!db) return;

  try {
    const metadataRef = db.collection('metadata').doc('candidateLastUpdate');

    await metadataRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: new Date().toISOString(),
      [`stateCounts.${stateCode}`]: count,
    }, { merge: true });
  } catch (error) {
    console.error(`Failed to update candidate metadata for ${stateCode}:`, error.message);
  }
}

/**
 * Update candidate metadata document (legacy)
 */
async function updateCandidateMetadata(candidateCount) {
  if (!db) return;

  try {
    const metadataRef = db.collection('metadata').doc('candidateLastUpdate');

    await metadataRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      candidateCount,
      updatedAt: new Date().toISOString()
    });

    console.log('Candidate metadata updated successfully');
  } catch (error) {
    console.error('Failed to update candidate metadata:', error.message);
  }
}

/**
 * Send FCM push notification to "updates" topic.
 * Non-throwing — notification failure shouldn't fail the pipeline.
 */
export async function sendUpdateNotification(companyCount, candidateCount) {
  try {
    const message = {
      topic: 'updates',
      notification: {
        title: 'DemocratDollar Data Updated',
        body: `${companyCount} companies and ${candidateCount} candidates refreshed with latest FEC data.`,
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('FCM notification sent:', response);
  } catch (error) {
    console.warn('Failed to send FCM notification (non-fatal):', error.message);
  }
}

/**
 * Clear all companies from Firestore
 */
export async function clearAllCompanies() {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  console.log('WARNING: Clearing all companies from Firestore...');

  const snapshot = await db.collection('companies').get();
  const BATCH_SIZE = 500;
  let batch = db.batch();
  let operationCount = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    operationCount++;

    if (operationCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  console.log(`Deleted ${snapshot.size} companies`);
}

/**
 * Get a company by slug
 */
export async function getCompany(slug) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  const doc = await db.collection('companies').doc(slug).get();
  if (!doc.exists) return null;
  return doc.data();
}

/**
 * Get all companies
 */
export async function getAllCompanies() {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  const snapshot = await db.collection('companies').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Query companies by category
 */
export async function getCompaniesByCategory(category) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  const snapshot = await db.collection('companies')
    .where('category', '==', category)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Query companies by industry
 */
export async function getCompaniesByIndustry(industry) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  const snapshot = await db.collection('companies')
    .where('industry', '==', industry)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Get all existing company document IDs from Firestore.
 */
export async function getAllCompanyIds() {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  const snapshot = await db.collection('companies').get();
  return new Set(snapshot.docs.map(doc => doc.id));
}

/**
 * Delete stale company documents that weren't pushed in the current pipeline run.
 * @param {Set<string>} pushedIds - IDs of companies successfully pushed this run
 */
export async function cleanupStaleCompanies(pushedIds) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  const existingIds = await getAllCompanyIds();
  const staleIds = [...existingIds].filter(id => !pushedIds.has(id));

  if (staleIds.length === 0) {
    console.log('No stale company documents to clean up.');
    return 0;
  }

  console.log(`\nCleaning up ${staleIds.length} stale company documents...`);

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let operationCount = 0;

  for (const oldId of staleIds) {
    batch.delete(db.collection('companies').doc(oldId));
    operationCount++;
    console.log(`  Deleting stale company: ${oldId}`);

    if (operationCount >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  console.log(`Deleted ${staleIds.length} stale company documents.`);
  return staleIds.length;
}

// Test exports — pure functions with no Firebase/network dependencies
export { toFirestoreValue as _toFirestoreValue, toFirestoreFields as _toFirestoreFields, DOUBLE_FIELDS as _DOUBLE_FIELDS };
