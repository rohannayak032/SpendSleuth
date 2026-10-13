#!/usr/bin/env node

/**
 * SpendSleuth – Transaction Processing Demo
 *
 * A runnable demonstration of the end-to-end transaction processing pipeline:
 *   Email → Modular Parser → Categorizer → Paise Conversion → SQLite Persistence
 *
 * Uses an in-memory SQLite database so it never touches real user data.
 *
 * Supported formats demonstrated:
 *   - Swiggy Dineout (Food)
 *   - Uber trip receipts (Transport)
 *   - Ola ride invoices (Transport)
 *   - Amazon order payments (Shopping)
 *   - Flipkart order payments (Shopping)
 *
 * Non-expense rejection demonstrated:
 *   - Order shipment notifications (Amazon)
 *   - Ride estimates (Uber)
 *   - OTP / non-transaction emails
 *   - Duplicate detection
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
    label: '1. Swiggy Dineout — Rs. 450.00 (Food)',
    subject: 'Swiggy Dineout payment of Rs. 450.00',
    body: 'Thank you for dining at Cafe Mocha. Your payment of Rs. 450.00 has been processed via Swiggy.',
    gmailMessageId: 'msg-demo-001',
    receivedDate: '2026-10-12T19:30:00Z',
  },
  {
    label: '2. Uber Trip Receipt — ₹342.50 (Transport)',
    subject: 'Your Monday evening trip with Uber',
    body: 'Thanks for riding with us. Total: ₹342.50. Paid via Credit Card. Trip completed.',
    gmailMessageId: 'msg-demo-002',
    receivedDate: '2026-10-12T20:00:00Z',
  },
  {
    label: '3. Ola Ride Invoice — ₹420.00 (Transport)',
    subject: 'Your Ola ride invoice [CRN8912345]',
    body: 'Here is your ride summary for trip CRN8912345. Total Bill: ₹420.00. Payment method: UPI.',
    gmailMessageId: 'msg-demo-003',
    receivedDate: '2026-10-12T20:30:00Z',
  },
  {
    label: '4. Amazon Order Payment — Rs. 1,499.00 (Shopping)',
    subject: 'Payment confirmation for your Amazon order',
    body: 'Thank you for your order. Amount Paid: Rs. 1,499.00 using Amazon Pay UPI.',
    gmailMessageId: 'msg-demo-004',
    receivedDate: '2026-10-12T21:00:00Z',
  },
  {
    label: '5. Flipkart Order Payment — Rs. 2,499.50 (Shopping)',
    subject: 'Payment received for your Flipkart order',
    body: 'We have received your payment of Rs. 2,499.50 for order OD123456789. Thank you for shopping with Flipkart!',
    gmailMessageId: 'msg-demo-005',
    receivedDate: '2026-10-12T21:30:00Z',
  },
  {
    label: '6. Amazon Shipment Notice (unsupported – shipment updates are not confirmed payments)',
    subject: 'Amazon Order Shipped',
    body: 'Your order of Rs. 899 from Amazon has been shipped and is on the way.',
    gmailMessageId: 'msg-demo-006',
    receivedDate: '2026-10-12T14:00:00Z',
  },
  {
    label: '7. Uber Ride Estimate (unsupported – price estimates are not completed expenses)',
    subject: 'Uber ride estimate for tomorrow',
    body: 'Estimated fare for your upcoming trip: Rs. 250 - Rs. 320.',
    gmailMessageId: 'msg-demo-007',
    receivedDate: '2026-10-12T15:00:00Z',
  },
  {
    label: '8. OTP Email (unsupported – not a transaction email)',
    subject: 'Your OTP is 483921',
    body: 'Your one-time password is 483921. Do not share this with anyone.',
    gmailMessageId: 'msg-demo-008',
    receivedDate: '2026-10-12T10:00:00Z',
  },
  {
    label: '9. Duplicate of email #1 (same Gmail message ID)',
    subject: 'Swiggy Dineout payment of Rs. 450.00',
    body: 'Thank you for dining at Cafe Mocha.',
    gmailMessageId: 'msg-demo-001', // same as email #1
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
console.log('  ℹ️  Supported formats: Swiggy Dineout, Uber, Ola, Amazon, Flipkart (confirmed payment receipts)');
console.log('  ℹ️  Database used: in-memory (no real data touched)');
console.log('══════════════════════════════════════════════════════════════════');
console.log('');
