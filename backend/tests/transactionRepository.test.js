const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { initSchema } = require('../src/db');
const { createTransactionRepository } = require('../src/db/transactionRepository');

describe('Transaction Repository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = new Database(':memory:');
    initSchema(db);
    repo = createTransactionRepository(db);
  });

  describe('create', () => {
    test('should insert transaction with required fields and apply defaults', () => {
      const created = repo.create({
        amount: 25075,
        merchant: 'Swiggy Dineout',
        transaction_date: '2026-09-05T12:30:00Z',
      });

      assert.ok(created.id, 'Transaction has auto-generated ID');
      assert.strictEqual(created.amount, 25075);
      assert.strictEqual(created.merchant, 'Swiggy Dineout');
      assert.strictEqual(created.transaction_date, '2026-09-05T12:30:00Z');
      assert.strictEqual(created.currency, 'INR');
      assert.strictEqual(created.transaction_type, 'expense');
      assert.strictEqual(created.category, 'General');
      assert.strictEqual(created.source, 'email');
      assert.strictEqual(created.gmail_message_id, null);
      assert.ok(created.created_at);
    });

    test('should insert transaction with all custom fields', () => {
      const created = repo.create({
        amount: 500000,
        currency: 'USD',
        transaction_type: 'income',
        merchant: 'Acme Corp',
        category: 'Salary',
        source: 'manual',
        gmail_message_id: 'msg-unique-100',
        transaction_date: '2026-09-01T09:00:00Z',
      });

      assert.strictEqual(created.amount, 500000);
      assert.strictEqual(created.currency, 'USD');
      assert.strictEqual(created.transaction_type, 'income');
      assert.strictEqual(created.merchant, 'Acme Corp');
      assert.strictEqual(created.category, 'Salary');
      assert.strictEqual(created.source, 'manual');
      assert.strictEqual(created.gmail_message_id, 'msg-unique-100');
    });

    test('should reject duplicate gmail_message_id', () => {
      repo.create({
        amount: 10000,
        merchant: 'Store A',
        gmail_message_id: 'msg-dup-1',
        transaction_date: '2026-09-05T10:00:00Z',
      });

      assert.throws(() => {
        repo.create({
          amount: 20000,
          merchant: 'Store B',
          gmail_message_id: 'msg-dup-1',
          transaction_date: '2026-09-05T11:00:00Z',
        });
      }, /UNIQUE constraint failed/);
    });

    test('should allow multiple transactions with null gmail_message_id', () => {
      const t1 = repo.create({
        amount: 1000,
        merchant: 'Cash Store 1',
        gmail_message_id: null,
        transaction_date: '2026-09-05T10:00:00Z',
      });
      const t2 = repo.create({
        amount: 2000,
        merchant: 'Cash Store 2',
        gmail_message_id: null,
        transaction_date: '2026-09-05T11:00:00Z',
      });

      assert.ok(t1.id);
      assert.ok(t2.id);
      assert.notStrictEqual(t1.id, t2.id);
    });
  });

  describe('findById and findByGmailMessageId', () => {
    test('should find transaction by primary key ID', () => {
      const created = repo.create({
        amount: 15000,
        merchant: 'Uber',
        category: 'Transport',
        transaction_date: '2026-09-04T18:00:00Z',
      });

      const found = repo.findById(created.id);
      assert.deepStrictEqual(found, created);
    });

    test('should return null when ID does not exist', () => {
      const found = repo.findById(99999);
      assert.strictEqual(found, null);
    });

    test('should find transaction by Gmail message ID', () => {
      const created = repo.create({
        amount: 89900,
        merchant: 'Amazon',
        category: 'Shopping',
        gmail_message_id: 'gmail-msg-xyz',
        transaction_date: '2026-09-03T14:20:00Z',
      });

      const found = repo.findByGmailMessageId('gmail-msg-xyz');
      assert.deepStrictEqual(found, created);
    });

    test('should return null when Gmail message ID does not exist or is empty', () => {
      assert.strictEqual(repo.findByGmailMessageId('nonexistent-msg'), null);
      assert.strictEqual(repo.findByGmailMessageId(null), null);
      assert.strictEqual(repo.findByGmailMessageId(''), null);
    });

    test('should check existence using existsByGmailMessageId', () => {
      repo.create({
        amount: 4500,
        merchant: 'Zomato',
        gmail_message_id: 'gmail-exists-1',
        transaction_date: '2026-09-05T13:00:00Z',
      });

      assert.strictEqual(repo.existsByGmailMessageId('gmail-exists-1'), true);
      assert.strictEqual(repo.existsByGmailMessageId('gmail-nonexistent'), false);
      assert.strictEqual(repo.existsByGmailMessageId(null), false);
    });
  });

  describe('findAll, filtering, and pagination', () => {
    beforeEach(() => {
      repo.create({
        amount: 10000,
        merchant: 'Swiggy Dineout',
        category: 'Food',
        source: 'email',
        transaction_type: 'expense',
        transaction_date: '2026-09-01T12:00:00Z',
      });
      repo.create({
        amount: 25000,
        merchant: 'Uber India',
        category: 'Transport',
        source: 'email',
        transaction_type: 'expense',
        transaction_date: '2026-09-02T15:00:00Z',
      });
      repo.create({
        amount: 50000,
        merchant: 'Amazon Shopping',
        category: 'Shopping',
        source: 'manual',
        transaction_type: 'expense',
        transaction_date: '2026-09-03T10:00:00Z',
      });
      repo.create({
        amount: 15000,
        merchant: 'Swiggy Instamart',
        category: 'Food',
        source: 'email',
        transaction_type: 'expense',
        transaction_date: '2026-09-04T20:00:00Z',
      });
      repo.create({
        amount: 300000,
        merchant: 'Consulting Client',
        category: 'Income',
        source: 'manual',
        transaction_type: 'income',
        transaction_date: '2026-09-05T09:00:00Z',
      });
    });

    test('should list all transactions ordered by transaction_date DESC by default', () => {
      const all = repo.findAll();
      assert.strictEqual(all.length, 5);
      assert.strictEqual(all[0].merchant, 'Consulting Client'); // Sep 5
      assert.strictEqual(all[4].merchant, 'Swiggy Dineout'); // Sep 1
    });

    test('should filter transactions by date range', () => {
      const results = repo.findByDateRange(
        '2026-09-02T00:00:00Z',
        '2026-09-04T23:59:59Z'
      );
      assert.strictEqual(results.length, 3);
      const merchants = results.map((r) => r.merchant);
      assert.ok(merchants.includes('Swiggy Instamart'));
      assert.ok(merchants.includes('Amazon Shopping'));
      assert.ok(merchants.includes('Uber India'));
    });

    test('should filter transactions by category', () => {
      const foodTransactions = repo.findByCategory('Food');
      assert.strictEqual(foodTransactions.length, 2);
      assert.ok(foodTransactions.every((r) => r.category === 'Food'));
    });

    test('should filter by transaction_type and source', () => {
      const incomes = repo.findAll({ transaction_type: 'income' });
      assert.strictEqual(incomes.length, 1);
      assert.strictEqual(incomes[0].merchant, 'Consulting Client');

      const manualItems = repo.findAll({ source: 'manual' });
      assert.strictEqual(manualItems.length, 2);
    });

    test('should filter by merchant substring match', () => {
      const swiggyItems = repo.findAll({ merchant: 'Swiggy' });
      assert.strictEqual(swiggyItems.length, 2);
    });

    test('should apply pagination with limit and offset', () => {
      const page1 = repo.findAll({ limit: 2, offset: 0 });
      const page2 = repo.findAll({ limit: 2, offset: 2 });
      const page3 = repo.findAll({ limit: 2, offset: 4 });

      assert.strictEqual(page1.length, 2);
      assert.strictEqual(page2.length, 2);
      assert.strictEqual(page3.length, 1);

      assert.strictEqual(page1[0].merchant, 'Consulting Client');
      assert.strictEqual(page2[0].merchant, 'Amazon Shopping');
      assert.strictEqual(page3[0].merchant, 'Swiggy Dineout');
    });

    test('should sort by custom allowed column and direction', () => {
      const sortedByAmount = repo.findAll({
        orderBy: 'amount',
        orderDirection: 'ASC',
      });
      assert.strictEqual(sortedByAmount[0].amount, 10000); // lowest
      assert.strictEqual(sortedByAmount[4].amount, 300000); // highest
    });

    test('should return accurate counts with count()', () => {
      assert.strictEqual(repo.count(), 5);
      assert.strictEqual(repo.count({ category: 'Food' }), 2);
      assert.strictEqual(repo.count({ transaction_type: 'income' }), 1);
      assert.strictEqual(
        repo.count({
          startDate: '2026-09-02T00:00:00Z',
          endDate: '2026-09-03T23:59:59Z',
        }),
        2
      );
    });
  });

  describe('update', () => {
    test('should update specified fields of an existing transaction', () => {
      const created = repo.create({
        amount: 5000,
        merchant: 'Unknown Vendor',
        category: 'General',
        transaction_date: '2026-09-05T10:00:00Z',
      });

      const updated = repo.update(created.id, {
        merchant: 'Corner Bakery',
        category: 'Food',
        amount: 5500,
      });

      assert.strictEqual(updated.id, created.id);
      assert.strictEqual(updated.merchant, 'Corner Bakery');
      assert.strictEqual(updated.category, 'Food');
      assert.strictEqual(updated.amount, 5500);
      assert.strictEqual(updated.currency, 'INR'); // untouched field preserved
    });

    test('should return null when updating a non-existent transaction', () => {
      const result = repo.update(99999, { category: 'Food' });
      assert.strictEqual(result, null);
    });

    test('should return current transaction unchanged when updates object is empty', () => {
      const created = repo.create({
        amount: 1200,
        merchant: 'Cafe',
        transaction_date: '2026-09-05T11:00:00Z',
      });

      const result = repo.update(created.id, {});
      assert.deepStrictEqual(result, created);
    });
  });

  describe('deleteById', () => {
    test('should delete existing transaction by ID and return true', () => {
      const created = repo.create({
        amount: 1000,
        merchant: 'Temp Store',
        transaction_date: '2026-09-05T12:00:00Z',
      });

      const deleted = repo.deleteById(created.id);
      assert.strictEqual(deleted, true);

      const found = repo.findById(created.id);
      assert.strictEqual(found, null);
    });

    test('should return false when deleting non-existent ID', () => {
      const deleted = repo.deleteById(99999);
      assert.strictEqual(deleted, false);
    });
  });

  describe('SQL Injection Prevention', () => {
    test('should treat SQL injection payloads as literal parameter values safely', () => {
      repo.create({
        amount: 1000,
        merchant: "Robert'); DROP TABLE transactions; --",
        category: 'General',
        transaction_date: '2026-09-05T12:00:00Z',
      });

      const injectionFilter = "' OR '1'='1";
      const results = repo.findAll({ category: injectionFilter });
      assert.strictEqual(results.length, 0);

      const foundMerchant = repo.findAll({ merchant: 'DROP TABLE' });
      assert.strictEqual(foundMerchant.length, 1);
      assert.strictEqual(
        foundMerchant[0].merchant,
        "Robert'); DROP TABLE transactions; --"
      );

      // Verify table still exists and functions normally
      assert.strictEqual(repo.count(), 1);
    });

    test('should fallback safely when invalid orderBy column is passed', () => {
      repo.create({
        amount: 1000,
        merchant: 'Store A',
        transaction_date: '2026-09-05T12:00:00Z',
      });

      const maliciousOrderBy = 'id; DROP TABLE transactions; --';
      const results = repo.findAll({ orderBy: maliciousOrderBy });
      assert.strictEqual(results.length, 1);
      assert.strictEqual(repo.count(), 1);
    });
  });
});
