const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../../expenses.db'));

db.exec(`
    CREATE TABLE IF NOT EXISTS transactions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    merchant TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    source TEXT,
    gmail_message_id TEXT UNIQUE,
    transaction_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP);

    CREATE TABLE IF NOT EXISTS oauth_tokens(
    id INTEGER PRIMARY KEY CHECK(id=1),
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER
    );
`);

module.exports = db;

