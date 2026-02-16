#!/usr/bin/env node

import dotenv from 'dotenv';
import { initFirebase, sendUpdateNotification } from './firebase-push.js';

dotenv.config();

const args = process.argv.slice(2);
const companyCount = parseInt(args[0]) || 0;
const candidateCount = parseInt(args[1]) || 0;

if (companyCount === 0 && candidateCount === 0) {
  console.log('Usage: node src/send-notification.js <companyCount> <candidateCount>');
  process.exit(1);
}

try {
  initFirebase();
  await sendUpdateNotification(companyCount, candidateCount);
  console.log('Notification sent successfully');
} catch (error) {
  console.error('Failed to send notification:', error.message);
  process.exit(1);
}
