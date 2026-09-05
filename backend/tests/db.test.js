const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { initSchema } = require('../src/db');

describe('Database schema and migrations', () => {
  let memDb;

  beforeEach(() => {
    memDb = new Database(':memory:');
    initSchema(memDb);
  });

  describe('Fresh schema initialization', () => {
    test('should create transactions and oauth_tokens tables with correct columns', () => {
      const columns = memDb.pragma('table_info(transactions)');
      const colMap = Object.fromEntries(columns.map((c) => [c.name, c]));

      assert.ok(colMap.id, 'id column exists');
      assert.strictEqual(colMap.id.pk, 1);

      assert.ok(colMap.amount, 'amount column exists');
      assert.strictEqual(colMap.amount.type.toUpperCase(), 'INTEGER');
      assert.strictEqual(colMap.amount.notnull, 1);

      assert.ok(colMap.currency, 'currency column exists');
      assert.strictEqual(colMap.currency.type.toUpperCase(), 'TEXT');
      assert.strictEqual(colMap.currency.notnull, 1);
      assert.strictEqual(colMap.currency.dflt_value, "'INR'");

      assert.ok(colMap.transaction_type, 'transaction_type column exists');
      assert.strictEqual(colMap.transaction_type.type.toUpperCase(), 'TEXT');
      assert.strictEqual(colMap.transaction_type.notnull, 1);
      assert.strictEqual(colMap.transaction_type.dflt_value, "'expense'");

      assert.ok(colMap.merchant, 'merchant column exists');
      assert.strictEqual(colMap.merchant.notnull, 1);

      assert.ok(colMap.category, 'category column exists');
      assert.strictEqual(colMap.category.dflt_value, "'General'");

      assert.ok(colMap.source, 'source column exists');
      assert.strictEqual(colMap.source.dflt_value, "'email'");

      assert.ok(colMap.gmail_message_id, 'gmail_message_id column exists');
      assert.ok(colMap.transaction_date, 'transaction_date column exists');
      assert.strictEqual(colMap.transaction_date.notnull, 1);

      assert.ok(colMap.created_at, 'created_at column exists');
      assert.strictEqual(colMap.created_at.notnull, 1);
    });

    test('should create query indexes for transaction_date and category', () => {
      const indexes = memDb
        .prepare(
          "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'transactions'"
        )
        .all();
      const indexNames = indexes.map((i) => i.name);

      assert.ok(
        indexNames.includes('idx_transactions_transaction_date'),
        'idx_transactions_transaction_date index exists'
      );
      assert.ok(
        indexNames.includes('idx_transactions_category'),
        'idx_transactions_category index exists'
      );
    });
  });

  describe('Insertions and default values', () => {
    test('should insert valid transaction and apply defaults', () => {
      const stmt = memDb.prepare(`
        INSERT INTO transactions (amount, merchant, transaction_date)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(45050, 'Swiggy', '2026-09-05T12:00:00Z');

      assert.strictEqual(result.changes, 1);
      const row = memDb
        .prepare('SELECT * FROM transactions WHERE id = ?')
        .get(result.lastInsertRowid);

      assert.strictEqual(row.amount, 45050);
      assert.strictEqual(row.merchant, 'Swiggy');
      assert.strictEqual(row.currency, 'INR');
      assert.strictEqual(row.transaction_type, 'expense');
      assert.strictEqual(row.category, 'General');
      assert.strictEqual(row.source, 'email');
      assert.strictEqual(row.gmail_message_id, null);
      assert.strictEqual(row.transaction_date, '2026-09-05T12:00:00Z');
      assert.ok(row.created_at);
    });

    test('should allow custom values overriding defaults', () => {
      const stmt = memDb.prepare(`
        INSERT INTO transactions (amount, currency, transaction_type, merchant, category, source, transaction_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        150000,
        'USD',
        'income',
        'Acme Corp Salary',
        'Salary',
        'manual',
        '2026-09-01T09:00:00Z'
      );

      const row = memDb
        .prepare('SELECT * FROM transactions WHERE id = ?')
        .get(result.lastInsertRowid);

      assert.strictEqual(row.amount, 150000);
      assert.strictEqual(row.currency, 'USD');
      assert.strictEqual(row.transaction_type, 'income');
      assert.strictEqual(row.category, 'Salary');
      assert.strictEqual(row.source, 'manual');
    });
  });

  describe('Constraints enforcement', () => {
    test('should reject non-positive amounts (zero and negative)', () => {
      const stmt = memDb.prepare(`
        INSERT INTO transactions (amount, merchant, transaction_date)
        VALUES (?, ?, ?)
      `);

      assert.throws(() => stmt.run(0, 'Store', '2026-09-05'), /CHECK constraint failed/);
      assert.throws(() => stmt.run(-100, 'Store', '2026-09-05'), /CHECK constraint failed/);
    });

    test('should reject empty or whitespace-only merchant names', () => {
      const stmt = memDb.prepare(`
        INSERT INTO transactions (amount, merchant, transaction_date)
        VALUES (?, ?, ?)
      `);

      assert.throws(() => stmt.run(100, '', '2026-09-05'), /CHECK constraint failed/);
      assert.throws(() => stmt.run(100, '   ', '2026-09-05'), /CHECK constraint failed/);
    });

    test('should reject invalid transaction_type', () => {
      const stmt = memDb.prepare(`
        INSERT INTO transactions (amount, merchant, transaction_type, transaction_date)
        VALUES (?, ?, ?, ?)
      `);

      assert.throws(
        () => stmt.run(100, 'Store', 'transfer', '2026-09-05'),
        /CHECK constraint failed/
      );
      assert.throws(
        () => stmt.run(100, 'Store', 'invalid_type', '2026-09-05'),
        /CHECK constraint failed/
      );
    });

    test('should reject currency codes not exactly 3 characters', () => {
      const stmt = memDb.prepare(`
        INSERT INTO transactions (amount, merchant, currency, transaction_date)
        VALUES (?, ?, ?, ?)
      `);

      assert.throws(
        () => stmt.run(100, 'Store', 'IN', '2026-09-05'),
        /CHECK constraint failed/
      );
      assert.throws(
        () => stmt.run(100, 'Store', 'RUPEES', '2026-09-05'),
        /CHECK constraint failed/
      );
    });

    test('should reject missing NOT NULL fields', () => {
      assert.throws(() => {
        memDb
          .prepare(
            'INSERT INTO transactions (merchant, transaction_date) VALUES (?, ?)'
          )
          .run('Store', '2026-09-05');
      }, /NOT NULL constraint failed/);

      assert.throws(() => {
        memDb
          .prepare(
            'INSERT INTO transactions (amount, transaction_date) VALUES (?, ?)'
          )
          .run(100, '2026-09-05');
      }, /NOT NULL constraint failed/);

      assert.throws(() => {
        memDb
          .prepare('INSERT INTO transactions (amount, merchant) VALUES (?, ?)')
          .run(100, 'Store');
      }, /NOT NULL constraint failed/);
    });
  });

  describe('Deduplication & uniqueness', () => {
    test('should reject duplicate gmail_message_id', () => {
      const stmt = memDb.prepare(`
        INSERT INTO transactions (amount, merchant, gmail_message_id, transaction_date)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(100, 'Store 1', 'msg-12345', '2026-09-05');

      assert.throws(() => {
        stmt.run(200, 'Store 2', 'msg-12345', '2026-09-05');
      }, /UNIQUE constraint failed/);
    });

    test('should allow multiple transactions with null gmail_message_id', () => {
      const stmt = memDb.prepare(`
        INSERT INTO transactions (amount, merchant, gmail_message_id, transaction_date)
        VALUES (?, ?, ?, ?)
      `);

      const r1 = stmt.run(100, 'Manual Store 1', null, '2026-09-05');
      const r2 = stmt.run(200, 'Manual Store 2', null, '2026-09-05');

      assert.ok(r1.lastInsertRowid);
      assert.ok(r2.lastInsertRowid);
    });
  });

  describe('Legacy schema migration', () => {
    test('should safely migrate legacy transactions table and convert float amounts to minor units', () => {
      const legacyDb = new Database(':memory:');

      // Create legacy schema (where amount was REAL, missing currency/transaction_type)
      legacyDb.exec(`
        CREATE TABLE transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          merchant TEXT NOT NULL,
          category TEXT DEFAULT 'General',
          source TEXT,
          gmail_message_id TEXT UNIQUE,
          transaction_date TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO transactions (amount, merchant, category, source, gmail_message_id, transaction_date)
        VALUES (125.50, 'Swiggy Dineout', 'Food', 'email', 'legacy-msg-1', '2026-07-31T10:00:00Z');
        INSERT INTO transactions (amount, merchant, category, source, gmail_message_id, transaction_date)
        VALUES (499.00, 'Amazon', 'Shopping', 'email', 'legacy-msg-2', '2026-08-01T15:30:00Z');
      `);

      // Run migration
      initSchema(legacyDb);

      // Verify table columns were updated
      const colInfo = legacyDb.pragma('table_info(transactions)');
      const amountCol = colInfo.find((c) => c.name === 'amount');
      const currencyCol = colInfo.find((c) => c.name === 'currency');
      const typeCol = colInfo.find((c) => c.name === 'transaction_type');

      assert.strictEqual(amountCol.type.toUpperCase(), 'INTEGER');
      assert.ok(currencyCol);
      assert.ok(typeCol);

      // Verify data was converted accurately
      const rows = legacyDb.prepare('SELECT * FROM transactions ORDER BY id ASC').all();
      assert.strictEqual(rows.length, 2);

      assert.strictEqual(rows[0].amount, 12550); // ₹125.50 -> 12550 paise
      assert.strictEqual(rows[0].merchant, 'Swiggy Dineout');
      assert.strictEqual(rows[0].currency, 'INR');
      assert.strictEqual(rows[0].transaction_type, 'expense');
      assert.strictEqual(rows[0].category, 'Food');
      assert.strictEqual(rows[0].gmail_message_id, 'legacy-msg-1');

      assert.strictEqual(rows[1].amount, 49900); // ₹499.00 -> 49900 paise
      assert.strictEqual(rows[1].merchant, 'Amazon');
      assert.strictEqual(rows[1].currency, 'INR');
      assert.strictEqual(rows[1].transaction_type, 'expense');
      assert.strictEqual(rows[1].category, 'Shopping');
      assert.strictEqual(rows[1].gmail_message_id, 'legacy-msg-2');
    });
  });

  describe('OAuth tokens table constraints', () => {
    test('should allow inserting token with id=1 and reject id!=1', () => {
      const stmt = memDb.prepare(`
        INSERT INTO oauth_tokens (id, access_token, refresh_token, expiry_date)
        VALUES (?, ?, ?, ?)
      `);

      const res = stmt.run(1, 'mock-access-token', 'mock-refresh-token', 1725530000000);
      assert.strictEqual(res.changes, 1);

      assert.throws(() => {
        stmt.run(2, 'another-access-token', 'another-refresh-token', 1725530000000);
      }, /CHECK constraint failed/);
    });
  });
});
