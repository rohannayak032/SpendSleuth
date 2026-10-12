const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { initSchema } = require('../src/db');
const { createTransactionRepository } = require('../src/db/transactionRepository');
const { processEmail } = require('../src/services/processEmail');

describe('processEmail – end-to-end transaction processing', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
    repo = createTransactionRepository(db);
  });

  describe('Successful processing (Swiggy Dineout)', () => {
    test('should parse, categorize, convert to paise, and save a Swiggy Dineout email', () => {
      const result = processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 450.00',
          body: 'Thank you for dining at Cafe Mocha via Swiggy.',
          gmailMessageId: 'msg-swiggy-001',
          receivedDate: '2026-10-12T19:30:00Z',
        },
        repo
      );

      assert.strictEqual(result.status, 'created');
      assert.ok(result.transaction.id, 'Transaction has auto-generated ID');
      assert.strictEqual(result.transaction.amount, 45000, 'Rs 450.00 → 45000 paise');
      assert.strictEqual(result.transaction.merchant, 'Swiggy');
      assert.strictEqual(result.transaction.category, 'Food');
      assert.strictEqual(result.transaction.currency, 'INR');
      assert.strictEqual(result.transaction.transaction_type, 'expense');
      assert.strictEqual(result.transaction.source, 'email');
      assert.strictEqual(result.transaction.gmail_message_id, 'msg-swiggy-001');
      assert.strictEqual(result.transaction.transaction_date, '2026-10-12T19:30:00Z');
    });

    test('should handle comma-formatted amounts and convert correctly', () => {
      const result = processEmail(
        {
          subject: 'Receipt',
          body: 'Swiggy Dineout payment of Rs. 1,250.50 processed.',
          gmailMessageId: 'msg-swiggy-002',
          receivedDate: '2026-10-12T20:00:00Z',
        },
        repo
      );

      assert.strictEqual(result.status, 'created');
      assert.strictEqual(result.transaction.amount, 125050, 'Rs 1,250.50 → 125050 paise');
      assert.strictEqual(result.transaction.merchant, 'Swiggy');
      assert.strictEqual(result.transaction.category, 'Food');
    });

    test('should handle whole-number amounts without decimals', () => {
      const result = processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs.350',
          body: 'Confirmed.',
          gmailMessageId: 'msg-swiggy-003',
          receivedDate: '2026-10-12T21:00:00Z',
        },
        repo
      );

      assert.strictEqual(result.status, 'created');
      assert.strictEqual(result.transaction.amount, 35000, 'Rs 350 → 35000 paise');
    });

    test('should allow null gmail_message_id (manual or incomplete data)', () => {
      const result = processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 200',
          body: '',
          gmailMessageId: null,
          receivedDate: '2026-10-12T22:00:00Z',
        },
        repo
      );

      assert.strictEqual(result.status, 'created');
      assert.strictEqual(result.transaction.gmail_message_id, null);
      assert.strictEqual(result.transaction.amount, 20000);
    });
  });

  describe('Unsupported email handling', () => {
    test('should return unsupported for non-transaction emails', () => {
      const result = processEmail(
        {
          subject: 'Your OTP is 123456',
          body: 'Do not share this OTP with anyone.',
          gmailMessageId: 'msg-otp-001',
          receivedDate: '2026-10-12T10:00:00Z',
        },
        repo
      );

      assert.strictEqual(result.status, 'unsupported');
      assert.ok(result.reason.includes('No supported transaction pattern'));
      assert.strictEqual(result.transaction, undefined);
    });

    test('should return unsupported for non-Swiggy-Dineout merchant emails', () => {
      // The parser currently ONLY supports Swiggy Dineout pattern
      const result = processEmail(
        {
          subject: 'Amazon Order Shipped',
          body: 'Your order total was Rs. 899.',
          gmailMessageId: 'msg-amazon-001',
          receivedDate: '2026-10-12T14:00:00Z',
        },
        repo
      );

      assert.strictEqual(result.status, 'unsupported');
    });

    test('should return unsupported for empty subject and body', () => {
      const result = processEmail(
        {
          subject: '',
          body: '',
          gmailMessageId: 'msg-empty-001',
          receivedDate: '2026-10-12T10:00:00Z',
        },
        repo
      );

      assert.strictEqual(result.status, 'unsupported');
    });

    test('should not insert any record for unsupported emails', () => {
      processEmail(
        {
          subject: 'Newsletter from TechCrunch',
          body: 'Top stories this week...',
          gmailMessageId: 'msg-news-001',
          receivedDate: '2026-10-12T08:00:00Z',
        },
        repo
      );

      assert.strictEqual(repo.count(), 0);
    });
  });

  describe('Duplicate Gmail message ID handling', () => {
    test('should reject duplicate Gmail message IDs and return existing transaction', () => {
      const first = processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 600',
          body: 'Payment confirmed.',
          gmailMessageId: 'msg-dup-test-001',
          receivedDate: '2026-10-12T12:00:00Z',
        },
        repo
      );
      assert.strictEqual(first.status, 'created');

      const duplicate = processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 600',
          body: 'Payment confirmed.',
          gmailMessageId: 'msg-dup-test-001',
          receivedDate: '2026-10-12T12:00:00Z',
        },
        repo
      );

      assert.strictEqual(duplicate.status, 'duplicate');
      assert.ok(duplicate.reason.includes('msg-dup-test-001'));
      assert.strictEqual(duplicate.transaction.id, first.transaction.id);
      assert.strictEqual(repo.count(), 1, 'Only one record persisted');
    });

    test('should allow processing different Gmail message IDs', () => {
      processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 300',
          body: '',
          gmailMessageId: 'msg-a',
          receivedDate: '2026-10-12T12:00:00Z',
        },
        repo
      );
      processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 500',
          body: '',
          gmailMessageId: 'msg-b',
          receivedDate: '2026-10-12T13:00:00Z',
        },
        repo
      );

      assert.strictEqual(repo.count(), 2);
    });

    test('should handle insertion-time uniqueness conflict when concurrent insert happens between pre-check and create', () => {
      // Simulate race condition: existsByGmailMessageId returns false (pre-check passes),
      // but another process commits the same Gmail message ID before repo.create finishes.
      const gmailMessageId = 'msg-race-condition-001';
      let existingRecord;

      const raceConditionRepo = {
        ...repo,
        existsByGmailMessageId: (_id) => false,
        create: (data) => {
          // Another worker inserted behind our back right before create executes:
          existingRecord = repo.create({
            amount: 99900,
            merchant: 'Swiggy',
            gmail_message_id: gmailMessageId,
            transaction_date: '2026-10-12T12:00:00Z',
          });
          // Calling the real create now causes better-sqlite3 to throw a real
          // SqliteError: UNIQUE constraint failed: transactions.gmail_message_id
          return repo.create(data);
        },
      };

      const result = processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 450.00',
          body: 'Payment confirmed.',
          gmailMessageId,
          receivedDate: '2026-10-12T12:05:00Z',
        },
        raceConditionRepo
      );

      assert.strictEqual(result.status, 'duplicate');
      assert.ok(result.reason.includes(gmailMessageId));
      assert.strictEqual(result.transaction.id, existingRecord.id);
      assert.strictEqual(repo.count(), 1, 'Only one record persisted');
    });

    test('should allow multiple transactions with missing or null gmailMessageId', () => {
      const r1 = processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 100',
          body: '',
          gmailMessageId: null,
          receivedDate: '2026-10-12T10:00:00Z',
        },
        repo
      );
      const r2 = processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 200',
          body: '',
          gmailMessageId: undefined,
          receivedDate: '2026-10-12T11:00:00Z',
        },
        repo
      );

      assert.strictEqual(r1.status, 'created');
      assert.strictEqual(r2.status, 'created');
      assert.strictEqual(r1.transaction.gmail_message_id, null);
      assert.strictEqual(r2.transaction.gmail_message_id, null);
      assert.notStrictEqual(r1.transaction.id, r2.transaction.id);
      assert.strictEqual(repo.count(), 2);
    });

    test('should rethrow unrelated database errors from repository create', () => {
      const failingRepo = {
        ...repo,
        create: () => {
          const err = new Error('Disk I/O error');
          err.code = 'SQLITE_IOERR';
          throw err;
        },
      };

      assert.throws(
        () =>
          processEmail(
            {
              subject: 'Swiggy Dineout payment of Rs. 450.00',
              body: 'Payment confirmed.',
              gmailMessageId: 'msg-err-001',
              receivedDate: '2026-10-12T12:00:00Z',
            },
            failingRepo
          ),
        /Disk I\/O error/
      );
    });

    test('should rethrow SQLite UNIQUE constraint errors on other columns', () => {
      const failingRepo = {
        ...repo,
        create: () => {
          const err = new Error('UNIQUE constraint failed: transactions.other_column');
          err.code = 'SQLITE_CONSTRAINT_UNIQUE';
          throw err;
        },
      };

      assert.throws(
        () =>
          processEmail(
            {
              subject: 'Swiggy Dineout payment of Rs. 450.00',
              body: 'Payment confirmed.',
              gmailMessageId: 'msg-other-unique-001',
              receivedDate: '2026-10-12T12:00:00Z',
            },
            failingRepo
          ),
        /UNIQUE constraint failed: transactions.other_column/
      );
    });
  });

  describe('Paise conversion edge cases', () => {
    test('should correctly convert amounts that cause float imprecision', () => {
      // 12.10 * 100 = 1209.9999... in IEEE 754; Math.round handles this
      const result = processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 12.10',
          body: '',
          gmailMessageId: 'msg-float-001',
          receivedDate: '2026-10-12T15:00:00Z',
        },
        repo
      );

      assert.strictEqual(result.status, 'created');
      assert.strictEqual(result.transaction.amount, 1210, 'Rs 12.10 → 1210 paise exactly');
    });

    test('should handle large Indian-formatted amounts', () => {
      const result = processEmail(
        {
          subject: 'Confirmation',
          body: 'Swiggy Dineout payment of Rs. 1,00,500.00 has been debited.',
          gmailMessageId: 'msg-large-001',
          receivedDate: '2026-10-12T16:00:00Z',
        },
        repo
      );

      assert.strictEqual(result.status, 'created');
      assert.strictEqual(result.transaction.amount, 10050000, 'Rs 1,00,500.00 → 10050000 paise');
    });
  });

  describe('Transaction retrievability after processing', () => {
    test('saved transaction should be retrievable by ID and Gmail message ID', () => {
      const result = processEmail(
        {
          subject: 'Swiggy Dineout payment of Rs. 750.25',
          body: 'Your bill at The Great Indian Kitchen.',
          gmailMessageId: 'msg-retrieve-001',
          receivedDate: '2026-10-12T18:00:00Z',
        },
        repo
      );

      const byId = repo.findById(result.transaction.id);
      assert.deepStrictEqual(byId, result.transaction);

      const byGmail = repo.findByGmailMessageId('msg-retrieve-001');
      assert.deepStrictEqual(byGmail, result.transaction);
    });
  });
});
