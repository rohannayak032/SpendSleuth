const defaultDb = require('./index');

/**
 * Allowed column names for ORDER BY clauses to prevent SQL injection.
 */
const ALLOWED_ORDER_COLUMNS = {
  id: 'id',
  transaction_date: 'transaction_date',
  transactionDate: 'transaction_date',
  amount: 'amount',
  created_at: 'created_at',
  createdAt: 'created_at',
  merchant: 'merchant',
  category: 'category',
};

/**
 * Creates a transaction repository instance bound to a specific SQLite database.
 * Enables dependency injection for test isolation and modular data access.
 *
 * @param {import('better-sqlite3').Database} db - better-sqlite3 database instance
 * @returns {Object} Transaction repository methods
 */
function createTransactionRepository(db = defaultDb) {
  /**
   * Inserts a new transaction record into the database.
   *
   * @param {Object} data - Transaction attributes
   * @param {number} data.amount - Amount in minor units (integer paise/cents)
   * @param {string} data.merchant - Merchant name
   * @param {string} data.transaction_date - ISO date string
   * @param {string} [data.currency='INR'] - ISO 4217 currency code
   * @param {string} [data.transaction_type='expense'] - 'expense' or 'income'
   * @param {string} [data.category='General'] - Transaction category
   * @param {string} [data.source='email'] - Ingestion source
   * @param {string|null} [data.gmail_message_id=null] - Gmail message ID
   * @returns {Object} The created transaction record
   */
  function create(data) {
    const stmt = db.prepare(`
      INSERT INTO transactions (
        amount,
        currency,
        transaction_type,
        merchant,
        category,
        source,
        gmail_message_id,
        transaction_date
      ) VALUES (
        ?,
        COALESCE(?, 'INR'),
        COALESCE(?, 'expense'),
        ?,
        COALESCE(?, 'General'),
        COALESCE(?, 'email'),
        ?,
        ?
      )
      RETURNING *
    `);

    return stmt.get(
      data.amount,
      data.currency || null,
      data.transaction_type || data.transactionType || null,
      data.merchant,
      data.category || null,
      data.source || null,
      data.gmail_message_id || data.gmailMessageId || null,
      data.transaction_date || data.transactionDate
    );
  }

  /**
   * Finds a transaction by its primary key ID.
   *
   * @param {number} id - Transaction primary key
   * @returns {Object|null} The transaction record or null if not found
   */
  function findById(id) {
    const stmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
    return stmt.get(id) || null;
  }

  /**
   * Finds a transaction by its unique Gmail message ID.
   *
   * @param {string} gmailMessageId - Gmail message ID
   * @returns {Object|null} The transaction record or null if not found
   */
  function findByGmailMessageId(gmailMessageId) {
    if (!gmailMessageId) return null;
    const stmt = db.prepare(
      'SELECT * FROM transactions WHERE gmail_message_id = ?'
    );
    return stmt.get(gmailMessageId) || null;
  }

  /**
   * Checks whether a transaction with the given Gmail message ID already exists.
   *
   * @param {string} gmailMessageId - Gmail message ID
   * @returns {boolean} True if exists, false otherwise
   */
  function existsByGmailMessageId(gmailMessageId) {
    if (!gmailMessageId) return false;
    const stmt = db.prepare(
      'SELECT 1 FROM transactions WHERE gmail_message_id = ? LIMIT 1'
    );
    return Boolean(stmt.get(gmailMessageId));
  }

  /**
   * Lists transactions with optional filtering, sorting, and pagination.
   * Uses parameterized queries and whitelisted column sorting to prevent SQL injection.
   *
   * @param {Object} [filters={}] - Filter criteria
   * @param {string} [filters.startDate] - Minimum transaction date (inclusive)
   * @param {string} [filters.endDate] - Maximum transaction date (inclusive)
   * @param {string} [filters.category] - Filter by category
   * @param {string} [filters.transaction_type] - Filter by transaction type
   * @param {string} [filters.transactionType] - CamelCase alias for transaction_type
   * @param {string} [filters.source] - Filter by ingestion source
   * @param {string} [filters.merchant] - Substring search for merchant
   * @param {string} [filters.orderBy='transaction_date'] - Column to order by
   * @param {string} [filters.orderDirection='DESC'] - 'ASC' or 'DESC'
   * @param {number} [filters.limit] - Max number of records to return
   * @param {number} [filters.offset] - Number of records to skip
   * @returns {Array<Object>} List of matching transactions
   */
  function findAll(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.startDate) {
      conditions.push('transaction_date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('transaction_date <= ?');
      params.push(filters.endDate);
    }

    if (filters.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }

    const type = filters.transaction_type || filters.transactionType;
    if (type) {
      conditions.push('transaction_type = ?');
      params.push(type);
    }

    if (filters.source) {
      conditions.push('source = ?');
      params.push(filters.source);
    }

    if (filters.merchant) {
      conditions.push('merchant LIKE ?');
      params.push(`%${filters.merchant}%`);
    }

    let sql = 'SELECT * FROM transactions';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const orderCol =
      ALLOWED_ORDER_COLUMNS[filters.orderBy] || 'transaction_date';
    const orderDir =
      typeof filters.orderDirection === 'string' &&
      filters.orderDirection.toUpperCase() === 'ASC'
        ? 'ASC'
        : 'DESC';

    sql += ` ORDER BY ${orderCol} ${orderDir}`;

    if (typeof filters.limit === 'number' && filters.limit > 0) {
      sql += ' LIMIT ?';
      params.push(filters.limit);

      if (typeof filters.offset === 'number' && filters.offset >= 0) {
        sql += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Convenience method to retrieve transactions within a date range.
   *
   * @param {string} startDate - Start date (inclusive)
   * @param {string} endDate - End date (inclusive)
   * @returns {Array<Object>} Transactions ordered by date descending
   */
  function findByDateRange(startDate, endDate) {
    return findAll({ startDate, endDate });
  }

  /**
   * Convenience method to retrieve transactions matching a category.
   *
   * @param {string} category - Category name
   * @returns {Array<Object>} Transactions ordered by date descending
   */
  function findByCategory(category) {
    return findAll({ category });
  }

  /**
   * Updates specified fields of an existing transaction by ID.
   *
   * @param {number} id - Transaction primary key
   * @param {Object} updates - Fields to update
   * @returns {Object|null} Updated transaction record, or null if not found
   */
  function update(id, updates) {
    const allowedFields = {
      amount: 'amount',
      currency: 'currency',
      transaction_type: 'transaction_type',
      transactionType: 'transaction_type',
      merchant: 'merchant',
      category: 'category',
      source: 'source',
      transaction_date: 'transaction_date',
      transactionDate: 'transaction_date',
    };

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      const colName = allowedFields[key];
      if (colName && value !== undefined) {
        setClauses.push(`${colName} = ?`);
        params.push(value);
      }
    }

    if (setClauses.length === 0) {
      return findById(id);
    }

    params.push(id);
    const sql = `
      UPDATE transactions
      SET ${setClauses.join(', ')}
      WHERE id = ?
      RETURNING *
    `;

    const stmt = db.prepare(sql);
    return stmt.get(...params) || null;
  }

  /**
   * Deletes a transaction by its primary key.
   *
   * @param {number} id - Transaction ID
   * @returns {boolean} True if a record was deleted, false if record was not found
   */
  function deleteById(id) {
    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Counts the total number of transactions matching the given filter criteria.
   *
   * @param {Object} [filters={}] - Filter criteria
   * @returns {number} Total count
   */
  function count(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.startDate) {
      conditions.push('transaction_date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push('transaction_date <= ?');
      params.push(filters.endDate);
    }

    if (filters.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }

    const type = filters.transaction_type || filters.transactionType;
    if (type) {
      conditions.push('transaction_type = ?');
      params.push(type);
    }

    if (filters.source) {
      conditions.push('source = ?');
      params.push(filters.source);
    }

    let sql = 'SELECT COUNT(*) AS total FROM transactions';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const stmt = db.prepare(sql);
    const result = stmt.get(...params);
    return result ? result.total : 0;
  }

  return {
    create,
    findById,
    findByGmailMessageId,
    existsByGmailMessageId,
    findAll,
    findByDateRange,
    findByCategory,
    update,
    deleteById,
    count,
  };
}

const transactionRepository = createTransactionRepository(defaultDb);

module.exports = transactionRepository;
module.exports.createTransactionRepository = createTransactionRepository;
