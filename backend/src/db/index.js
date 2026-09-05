const Database = require('better-sqlite3');
const config = require('../config');

/**
 * Initializes and migrates database schemas for SpendSleuth.
 * Ensures backward compatibility with legacy schema prototypes while enforcing
 * strict financial constraints (integer minor units, transaction types, currencies).
 *
 * @param {Database.Database} database - better-sqlite3 database instance
 * @returns {Database.Database}
 */
function initSchema(database) {
  database.pragma('foreign_keys = ON');

  const tableInfo = database.pragma('table_info(transactions)');

  if (tableInfo.length === 0) {
    // Fresh database initialization
    database.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount INTEGER NOT NULL CHECK (amount > 0),
        currency TEXT NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
        transaction_type TEXT NOT NULL DEFAULT 'expense' CHECK (transaction_type IN ('expense', 'income')),
        merchant TEXT NOT NULL CHECK (length(trim(merchant)) > 0),
        category TEXT NOT NULL DEFAULT 'General',
        source TEXT DEFAULT 'email',
        gmail_message_id TEXT UNIQUE,
        transaction_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        access_token TEXT,
        refresh_token TEXT,
        expiry_date INTEGER
      );
    `);
  } else {
    // Inspect existing schema to determine if migration is required
    const columnNames = tableInfo.map((col) => col.name);
    const amountCol = tableInfo.find((col) => col.name === 'amount');
    const isLegacyAmount = amountCol && amountCol.type.toUpperCase() === 'REAL';
    const isMissingColumns =
      !columnNames.includes('currency') ||
      !columnNames.includes('transaction_type') ||
      !columnNames.includes('transaction_date');

    if (isLegacyAmount || isMissingColumns) {
      const migrate = database.transaction(() => {
        database.exec(`
          CREATE TABLE transactions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount INTEGER NOT NULL CHECK (amount > 0),
            currency TEXT NOT NULL DEFAULT 'INR' CHECK (length(currency) = 3),
            transaction_type TEXT NOT NULL DEFAULT 'expense' CHECK (transaction_type IN ('expense', 'income')),
            merchant TEXT NOT NULL CHECK (length(trim(merchant)) > 0),
            category TEXT NOT NULL DEFAULT 'General',
            source TEXT DEFAULT 'email',
            gmail_message_id TEXT UNIQUE,
            transaction_date TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Convert floating-point amounts (rupees) to integer minor units (paise) if legacy REAL
        const amountExpr = isLegacyAmount
          ? 'CAST(ROUND(amount * 100) AS INTEGER)'
          : 'amount';
        const dateExpr = columnNames.includes('transaction_date')
          ? "COALESCE(transaction_date, created_at, datetime('now'))"
          : "COALESCE(created_at, datetime('now'))";

        database.exec(`
          INSERT INTO transactions_new (
            id, amount, currency, transaction_type, merchant, category, source, gmail_message_id, transaction_date, created_at
          )
          SELECT
            id,
            ${amountExpr} AS amount,
            'INR' AS currency,
            'expense' AS transaction_type,
            COALESCE(NULLIF(TRIM(merchant), ''), 'Unknown') AS merchant,
            COALESCE(category, 'General') AS category,
            source,
            gmail_message_id,
            ${dateExpr} AS transaction_date,
            COALESCE(created_at, CURRENT_TIMESTAMP) AS created_at
          FROM transactions;

          DROP TABLE transactions;
          ALTER TABLE transactions_new RENAME TO transactions;

          CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);
          CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
        `);
      });

      migrate();
    } else {
      // Schema structure is up to date; ensure indexes exist
      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date ON transactions(transaction_date);
        CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
      `);
    }

    database.exec(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        access_token TEXT,
        refresh_token TEXT,
        expiry_date INTEGER
      );
    `);
  }

  return database;
}

const db = new Database(config.db.path);
initSchema(db);

module.exports = db;
module.exports.initSchema = initSchema;
