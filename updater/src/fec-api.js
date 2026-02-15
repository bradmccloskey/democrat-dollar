import dotenv from 'dotenv';
dotenv.config();

export const FEC_API_BASE = 'https://api.open.fec.gov/v1';
export const API_KEY = process.env.FEC_API_KEY;

// Rate limiting configuration
const RATE_LIMIT_DELAY = 3600; // 3.6 seconds between requests to stay safely under 1000/hour
const MAX_CONSECUTIVE_429S = 8; // Abort after this many 429s in a row
const MAX_RETRIES = 5;

// Rate limiting state
let lastRequestTime = 0;
let consecutive429s = 0;

export class RateLimitExhaustedError extends Error {
  constructor() {
    super('FEC API rate limit exhausted. Get a real API key at https://api.data.gov/signup');
    this.name = 'RateLimitExhaustedError';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make a rate-limited request to the FEC API.
 * Enforces minimum delay between requests and handles 429 responses
 * with exponential backoff.
 */
export async function rateLimitedFetch(url) {
  if (consecutive429s >= MAX_CONSECUTIVE_429S) {
    throw new RateLimitExhaustedError();
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await sleep(RATE_LIMIT_DELAY - timeSinceLastRequest);
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    lastRequestTime = Date.now();
    const response = await fetch(url);

    if (response.status === 429) {
      consecutive429s++;
      if (consecutive429s >= MAX_CONSECUTIVE_429S) {
        throw new RateLimitExhaustedError();
      }
      const backoff = Math.min(10000 * Math.pow(2, attempt), 120000);
      console.log(`    Rate limited (429). Retrying in ${backoff / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(backoff);
      continue;
    }

    if (!response.ok) {
      throw new Error(`FEC API error: ${response.status} ${response.statusText}`);
    }

    // Successful request — reset consecutive 429 counter
    consecutive429s = 0;
    return response.json();
  }

  throw new Error('FEC API error: 429 Too Many Requests (retries exhausted)');
}
