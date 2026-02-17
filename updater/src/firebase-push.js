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
 * Convert company name to a URL-friendly slug
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/&/g, '-and-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Convert a company data object to Firestore REST API field format.
 * Explicitly sets doubleValue for fields Swift expects as Double,
 * integerValue for Int fields, preventing type mismatch decode failures.
 */
const DOUBLE_FIELDS = new Set([
  'totalDemocrat', 'totalRepublican', 'totalOther', 'totalContributions',
  'percentDemocrat', 'percentRepublican'
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
  if (typeof val === 'number') {
    // Fields Swift expects as Double must be doubleValue
    if (DOUBLE_FIELDS.has(key)) return { doubleValue: val };
    // Everything else (rank, disbursementCount) stays as integer
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
async function updateMetadata(companyCount) {
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
 * Push candidates for a single state to Firestore.
 * Batch writes scoped to one state. Deletes stale candidates for that state.
 */
export async function pushCandidatesForState(stateCode, candidates) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  console.log(`\nPushing ${candidates.length} candidates for ${stateCode} to Firestore...`);

  // Get existing candidates for this state (for stale cleanup)
  const existingSnapshot = await db.collection('candidates')
    .where('state', '==', stateCode)
    .get();

  const existingIds = new Set(existingSnapshot.docs.map(doc => doc.id));
  const freshIds = new Set();

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let operationCount = 0;
  let batchCount = 0;

  for (const candidateData of candidates) {
    const candidateId = slugify(candidateData.candidateId || candidateData.name);
    freshIds.add(candidateId);

    const docData = {
      ...candidateData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      slug: candidateId
    };

    const docRef = db.collection('candidates').doc(candidateId);
    batch.set(docRef, docData);
    operationCount++;

    if (operationCount >= BATCH_SIZE) {
      await batch.commit();
      batchCount++;
      batch = db.batch();
      operationCount = 0;
    }
  }

  // Delete stale candidates (existed before but not in fresh batch)
  for (const oldId of existingIds) {
    if (!freshIds.has(oldId)) {
      batch.delete(db.collection('candidates').doc(oldId));
      operationCount++;
      console.log(`  Deleting stale candidate: ${oldId}`);

      if (operationCount >= BATCH_SIZE) {
        await batch.commit();
        batchCount++;
        batch = db.batch();
        operationCount = 0;
      }
    }
  }

  if (operationCount > 0) {
    await batch.commit();
    batchCount++;
  }

  console.log(`  Pushed ${candidates.length} candidates for ${stateCode} in ${batchCount} batch(es)`);

  // Update candidate metadata with state counts
  await updateCandidateMetadataForState(stateCode, candidates.length);
}

/**
 * Push presidential candidates to Firestore.
 */
export async function pushPresidentialCandidates(candidates) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  console.log(`\nPushing ${candidates.length} presidential candidates to Firestore...`);

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let operationCount = 0;
  let batchCount = 0;

  for (const candidateData of candidates) {
    const candidateId = slugify(candidateData.candidateId || candidateData.name);

    const docData = {
      ...candidateData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      slug: candidateId
    };

    const docRef = db.collection('candidates').doc(candidateId);
    batch.set(docRef, docData);
    operationCount++;

    if (operationCount >= BATCH_SIZE) {
      await batch.commit();
      batchCount++;
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
    batchCount++;
  }

  console.log(`  Pushed ${candidates.length} presidential candidates in ${batchCount} batch(es)`);
}

/**
 * Push all candidates to Firestore in batches (legacy — used for single-state runs)
 */
export async function pushAllCandidates(candidates) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  console.log(`\nPushing ${candidates.length} candidates to Firestore...`);

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let operationCount = 0;
  let batchCount = 0;

  for (const candidateData of candidates) {
    const candidateId = slugify(candidateData.candidateId || candidateData.name);

    const docData = {
      ...candidateData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      slug: candidateId
    };

    const docRef = db.collection('candidates').doc(candidateId);
    batch.set(docRef, docData);
    operationCount++;

    if (operationCount >= BATCH_SIZE) {
      await batch.commit();
      batchCount++;
      console.log(`  Committed batch ${batchCount} (${operationCount} candidates)`);
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
    batchCount++;
    console.log(`  Committed final batch ${batchCount} (${operationCount} candidates)`);
  }

  console.log(`Successfully pushed ${candidates.length} candidates in ${batchCount} batch(es)`);

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
