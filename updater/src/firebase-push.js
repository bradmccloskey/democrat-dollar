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
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/&/g, '-and-')      // Replace & with 'and'
    .replace(/[^\w\-]+/g, '')    // Remove all non-word chars except hyphens
    .replace(/\-\-+/g, '-')      // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start of text
    .replace(/-+$/, '');         // Trim - from end of text
}

/**
 * Push a single company to Firestore
 */
export async function pushCompany(companyData) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  const companyId = slugify(companyData.name);

  const docData = {
    ...companyData,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    slug: companyId
  };

  try {
    await db.collection('companies').doc(companyId).set(docData);
    console.log(`  Pushed ${companyData.name} to Firestore (${companyId})`);
    return companyId;
  } catch (error) {
    console.error(`  Failed to push ${companyData.name}:`, error.message);
    throw error;
  }
}

/**
 * Push all companies to Firestore in batches
 * Firestore batch limit is 500 operations
 */
export async function pushAllCompanies(companies) {
  if (!db) {
    throw new Error('Firebase not initialized. Call initFirebase() first.');
  }

  console.log(`\nPushing ${companies.length} companies to Firestore...`);

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let operationCount = 0;
  let batchCount = 0;

  for (const companyData of companies) {
    const companyId = slugify(companyData.name);

    const docData = {
      ...companyData,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      slug: companyId
    };

    const docRef = db.collection('companies').doc(companyId);
    batch.set(docRef, docData);
    operationCount++;

    // Commit batch when we reach the limit
    if (operationCount >= BATCH_SIZE) {
      await batch.commit();
      batchCount++;
      console.log(`  Committed batch ${batchCount} (${operationCount} companies)`);

      // Start a new batch
      batch = db.batch();
      operationCount = 0;
    }
  }

  // Commit any remaining operations
  if (operationCount > 0) {
    await batch.commit();
    batchCount++;
    console.log(`  Committed final batch ${batchCount} (${operationCount} companies)`);
  }

  console.log(`Successfully pushed ${companies.length} companies in ${batchCount} batch(es)`);

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
 * Clear all companies from Firestore (use with caution!)
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

  if (!doc.exists) {
    return null;
  }

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
