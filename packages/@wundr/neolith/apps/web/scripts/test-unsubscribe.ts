/**
 * Test script for unsubscribe functionality
 *
 * This script demonstrates how to generate unsubscribe URLs and verify tokens.
 * Run with: npx tsx scripts/test-unsubscribe.ts
 */

import {
  generateUnsubscribeUrl,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../lib/email';
import type { EmailType } from '../lib/email';

console.log('🧪 Testing Email Unsubscribe Functionality\n');

// Test user ID
const testUserId = 'test-user-123';
const emailTypes: EmailType[] = ['marketing', 'notifications', 'digest', 'all'];

console.log('='.repeat(80));
console.log('1. Generating Unsubscribe URLs');
console.log('='.repeat(80));

emailTypes.forEach(emailType => {
  const url = generateUnsubscribeUrl(testUserId, emailType);
  console.log(`\n${emailType.toUpperCase()} emails:`);
  console.log(`  URL: ${url}`);
});

console.log('\n' + '='.repeat(80));
console.log('2. Generating and Verifying Tokens');
console.log('='.repeat(80));

emailTypes.forEach(emailType => {
  const token = generateUnsubscribeToken(testUserId, emailType);
  const payload = verifyUnsubscribeToken(token);

  console.log(`\n${emailType.toUpperCase()}:`);
  console.log(`  Token: ${token.substring(0, 50)}...`);
  console.log(`  Verified: ${payload ? '✅ Valid' : '❌ Invalid'}`);

  if (payload) {
    console.log(`  User ID: ${payload.userId}`);
    console.log(`  Email Type: ${payload.emailType}`);
    console.log(`  Timestamp: ${new Date(payload.timestamp).toISOString()}`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('3. Testing Invalid Tokens');
console.log('='.repeat(80));

const invalidTokens = [
  { name: 'Empty token', token: '' },
  { name: 'Malformed token', token: 'invalid.token.format' },
  { name: 'Wrong signature', token: 'eyJ1c2VySWQiOiJ0ZXN0In0.wrongsignature' },
];

invalidTokens.forEach(({ name, token }) => {
  const payload = verifyUnsubscribeToken(token);
  console.log(`\n${name}:`);
  console.log(
    `  Result: ${payload ? '✅ Valid (UNEXPECTED!)' : '❌ Invalid (expected)'}`
  );
});

console.log('\n' + '='.repeat(80));
console.log('4. Example Email Footer');
console.log('='.repeat(80));

const exampleUrl = generateUnsubscribeUrl('user-abc-123', 'notifications');
console.log(`
Email Footer Example:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You're receiving this email because you opted in to receive notifications
from Neolith. You can update your email preferences or unsubscribe at any time.

Unsubscribe from notifications: ${exampleUrl}
Manage all preferences: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings/notifications

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

console.log('\n✅ All tests completed!\n');
