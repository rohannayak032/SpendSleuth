#!/usr/bin/env node

/**
 * SpendSleuth – Transaction Processing Demo
 *
 * A runnable demonstration of the end-to-end transaction processing pipeline:
 *   Email → Parser → Categorizer → Paise conversion → SQLite persistence
 *
 * Uses an in-memory SQLite database so it never touches real user data.
 *
 * Run:  node demo.js
 */

const Database = require('better-sqlite3');
const { initSchema } = require('./src/db');
const { createTransactionRepository } = require('./src/db/transactionRepository');
const { processEmail } = require('./src/services/processEmail');

// ─── Setup: in-memory database ──────────────────────────────────────────────
const db = new Database(':memory:');
initSchema(db);
const repo = createTransactionRepository(db);

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║          SpendSleuth – Transaction Processing Demo             ║');
console.log('║   Email → Parse → Categorize → Convert to Paise → Persist     ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');

// ─── Sample emails to process ───────────────────────────────────────────────
const sampleEmails = [
  {
    label: '1. Swiggy Dineout — Rs. 450.00 (supported)',
    subject: 'Swiggy Dineout payment of Rs. 450.00',
    body: 'Thank you for dining at Cafe Mocha. Your payment of Rs. 450.00 has been processed via Swiggy.',
    gmailMessageId: 'msg-demo-001',
    receivedDate: '2026-10-12T19:30:00Z',
  },
  {
    label: '2. Swiggy Dineout — Rs. 1,250.50 with commas (supported)',
    subject: 'Payment Receipt',
    body: 'Your Swiggy Dineout payment of Rs. 1,250.50 was successful. Enjoy your meal!',
    gmailMessageId: 'msg-demo-002',
    receivedDate: '2026-10-12T20:15:00Z',
  },
  {
    label: '3. Amazon Order (unsupported – parser only handles Swiggy Dineout)',
    subject: 'Amazon Order Shipped',
    body: 'Your order of Rs. 899 from Amazon has been shipped.',
    gmailMessageId: 'msg-demo-003',
    receivedDate: '2026-10-12T14:00:00Z',
  },
  {
    label: '4. OTP Email (unsupported – not a transaction email)',
    subject: 'Your OTP is 483921',
    body: 'Your one-time password is 483921. Do not share this with anyone.',
    gmailMessageId: 'msg-demo-004',
    receivedDate: '2026-10-12T10:00:00Z',
  },
  {
    label: '5. Duplicate of email #1 (same Gmail message ID)',
    subject: 'Swiggy Dineout payment of Rs. 450.00',
    body: 'Thank you for dining at Cafe Mocha.',
    gmailMessageId: 'msg-demo-001',  // same as email #1
    receivedDate: '2026-10-12T19:30:00Z',
  },
];

// ─── Process each email ─────────────────────────────────────────────────────
for (const email of sampleEmails) {
  console.log(`──── ${email.label} ────`);
  console.log(`  Subject: ${email.subject}`);
  console.log(`  Body:    ${email.body.substring(0, 80)}${email.body.length > 80 ? '...' : ''}`);

  const result = processEmail(
    {
      subject: email.subject,
      body: email.body,
      gmailMessageId: email.gmailMessageId,
      receivedDate: email.receivedDate,
    },
    repo
  );

  if (result.status === 'created') {
    const t = result.transaction;
    console.log(`  ✅ CREATED`);
    console.log(`     ID:       ${t.id}`);
    console.log(`     Amount:   ${t.amount} paise (₹${(t.amount / 100).toFixed(2)})`);
    console.log(`     Merchant: ${t.merchant}`);
    console.log(`     Category: ${t.category}`);
    console.log(`     Currency: ${t.currency}`);
    console.log(`     Type:     ${t.transaction_type}`);
    console.log(`     Source:   ${t.source}`);
    console.log(`     Gmail ID: ${t.gmail_message_id}`);
    console.log(`     Date:     ${t.transaction_date}`);
  } else if (result.status === 'unsupported') {
    console.log(`  ⚠️  UNSUPPORTED – ${result.reason}`);
  } else if (result.status === 'duplicate') {
    console.log(`  🔁 DUPLICATE – ${result.reason}`);
    console.log(`     Existing transaction ID: ${result.transaction.id}`);
  }
  console.log('');
}

// ─── Summary ────────────────────────────────────────────────────────────────
const allTransactions = repo.findAll();
console.log('══════════════════════════════════════════════════════════════════');
console.log(`  Database summary: ${allTransactions.length} transaction(s) saved`);
console.log('');
for (const t of allTransactions) {
  console.log(`  [${t.id}] ₹${(t.amount / 100).toFixed(2)} → ${t.merchant} (${t.category}) on ${t.transaction_date}`);
}
console.log('');
console.log('  ℹ️  Parser currently supports: Swiggy Dineout emails only');
console.log('  ℹ️  Database used: in-memory (no real data touched)');
console.log('══════════════════════════════════════════════════════════════════');
console.log('');
