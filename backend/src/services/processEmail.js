const { parseEmail } = require('./parser');
const { categorize } = require('./categorizer');

/**
 * Checks whether an error is specifically a SQLite UNIQUE constraint violation
 * on the transactions.gmail_message_id column.
 *
 * @param {any} error
 * @returns {boolean}
 */
function isGmailMessageIdUniqueConstraintError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const isUniqueConstraint =
    error.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    (typeof error.message === 'string' && /UNIQUE constraint failed/i.test(error.message));

  return Boolean(
    isUniqueConstraint &&
      typeof error.message === 'string' &&
      error.message.includes('transactions.gmail_message_id')
  );
}

/**
 * Processes a single transaction email through the full pipeline:
 *   1. Parse the email subject+body to extract amount (rupees) and merchant.
 *   2. Check for duplicate Gmail message IDs (fast pre-check).
 *   3. Categorize the extracted merchant using rule-based categorizer.
 *   4. Convert the parsed rupee amount to integer paise for storage.
 *   5. Persist through the transaction repository, handling insertion-time
 *      race conditions / uniqueness conflicts gracefully.
 *
 * Design decisions:
 * - Returns a result object with { status, transaction?, reason? } instead of
 *   throwing, so callers can handle each case without try/catch logic.
 * - Deduplication is two-layered: a fast pre-check (repo.existsByGmailMessageId)
 *   and an insertion-time conflict handler catching SQLite UNIQUE constraint errors
 *   to guard against race conditions across concurrent processes.
 * - Only UNIQUE violations on transactions.gmail_message_id are caught as duplicates;
 *   unrelated database errors are rethrown.
 * - Amount conversion uses Math.round to avoid floating-point drift
 *   (e.g. 12.50 * 100 = 1249.9999... -> 1250 after rounding).
 * - Accepts an injected repository for test isolation (in-memory DB).
 *
 * @param {Object} params
 * @param {string} params.subject - Email subject line
 * @param {string} params.body - Email body text
 * @param {string|null} [params.gmailMessageId] - Unique Gmail message ID
 * @param {string} params.receivedDate - ISO 8601 date string for the email
 * @param {Object} repo - Transaction repository instance (injected for testing)
 * @returns {Object} Result: { status: 'created'|'unsupported'|'duplicate', transaction?, reason? }
 */
function processEmail({ subject, body, gmailMessageId, receivedDate }, repo) {
  // Step 1: Parse – the parser only supports Swiggy Dineout emails currently
  const parsed = parseEmail(subject, body);
  if (!parsed) {
    return {
      status: 'unsupported',
      reason: 'No supported transaction pattern found in this email.',
    };
  }

  // Step 2: Deduplicate by Gmail message ID (fast pre-check)
  if (gmailMessageId && repo.existsByGmailMessageId(gmailMessageId)) {
    return {
      status: 'duplicate',
      reason: `Gmail message ID '${gmailMessageId}' has already been processed.`,
      transaction: repo.findByGmailMessageId(gmailMessageId),
    };
  }

  // Step 3: Categorize the merchant
  const category = categorize(parsed.merchant);

  // Step 4: Convert rupees (float) to paise (integer) for the schema's
  // INTEGER amount column.  Math.round guards against float imprecision.
  const amountPaise = Math.round(parsed.amount * 100);

  // Step 5: Persist with insertion-time uniqueness conflict handling
  try {
    const transaction = repo.create({
      amount: amountPaise,
      merchant: parsed.merchant,
      category,
      source: 'email',
      gmail_message_id: gmailMessageId || null,
      transaction_date: receivedDate,
    });

    return { status: 'created', transaction };
  } catch (error) {
    if (gmailMessageId && isGmailMessageIdUniqueConstraintError(error)) {
      return {
        status: 'duplicate',
        reason: `Gmail message ID '${gmailMessageId}' has already been processed.`,
        transaction: repo.findByGmailMessageId(gmailMessageId),
      };
    }
    throw error;
  }
}

module.exports = { processEmail };
