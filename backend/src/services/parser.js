/**
 * SpendSleuth Email Parser
 *
 * Modular parser registry for extracting transaction amount (rupees) and
 * merchant from confirmed transaction emails.
 *
 * Supported formats:
 *   1. Swiggy Dineout – In-dining restaurant payment receipts
 *   2. Uber – Completed trip receipts / ride invoices
 *   3. Ola – Ride invoice / trip summary bills
 *   4. Amazon – Confirmed order payment receipts / Amazon Pay receipts
 *   5. Flipkart – Confirmed order payment receipts
 *
 * Excluded by design:
 *   - District: No stable, verified receipt template available without
 *     inventing unsupported synthetic assumptions.
 *   - Shipment updates, dispatch notices, out-for-delivery alerts,
 *     ride estimates, live driver arrival alerts, or booking confirmations:
 *     Only confirmed charges/payments are classified as expenses.
 */

/**
 * Cleans a numeric string (strips commas and whitespace) and returns a valid positive float.
 *
 * @param {string} str
 * @returns {number|null}
 */
function parseAmount(str) {
  if (!str) return null;
  const cleaned = str.replace(/,/g, '').trim();
  const amount = parseFloat(cleaned);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/**
 * Parses Swiggy Dineout payment emails.
 * Preserves 100% backward compatibility with the existing pattern.
 *
 * @param {string} text
 * @returns {{ amount: number, merchant: string } | null}
 */
function parseSwiggyDineout(text) {
  const match = text.match(/Swiggy Dineout payment of Rs\.\s?([\d,]+\.?\d*)/i);
  if (!match) return null;
  const amount = parseAmount(match[1]);
  return amount ? { amount, merchant: 'Swiggy' } : null;
}

/**
 * Parses Uber trip receipt emails.
 *
 * Synthetic Fixture Assumptions:
 * - Email contains completed trip receipt / total charge information.
 * - Negative filters explicitly reject ride estimates, scheduled trip alerts,
 *   cancellations, or live driver arrival notifications.
 *
 * @param {string} text
 * @returns {{ amount: number, merchant: string } | null}
 */
function parseUber(text) {
  if (!/uber/i.test(text)) return null;

  // Reject non-expense notifications
  if (/estimate|scheduled|cancell?ed|is arriving/i.test(text)) {
    return null;
  }

  // Must indicate a completed trip receipt or payment
  if (!/(?:trip|ride|receipt)/i.test(text)) {
    return null;
  }

  const patterns = [
    /(?:total(?: fare| paid)?|trip fare|charged):?\s*(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
    /Uber\s*(?:trip )?receipt.*?(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount) {
        return { amount, merchant: 'Uber' };
      }
    }
  }

  return null;
}

/**
 * Parses Ola ride invoice emails.
 *
 * Synthetic Fixture Assumptions:
 * - Email contains completed ride invoice or final trip bill.
 * - Negative filters explicitly reject booking confirmations (driver on way),
 *   fare estimates, or cancellation notices.
 *
 * @param {string} text
 * @returns {{ amount: number, merchant: string } | null}
 */
function parseOla(text) {
  if (!/ola/i.test(text)) return null;

  // Reject non-expense notifications
  if (/estimate|scheduled|cancell?ed|driver (?:is )?on the way/i.test(text)) {
    return null;
  }

  // Must indicate an invoice, receipt, or final ride bill
  if (!/(?:invoice|receipt|ride summary|total bill)/i.test(text)) {
    return null;
  }

  const patterns = [
    /(?:total (?:bill|payable|fare|paid)|ride fare):?\s*(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
    /Ola ride invoice.*?(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount) {
        return { amount, merchant: 'Ola' };
      }
    }
  }

  return null;
}

/**
 * Parses Amazon order payment confirmation emails.
 *
 * Synthetic Fixture Assumptions:
 * - Email confirms successful payment or charge for an Amazon order or Amazon Pay transaction.
 * - Negative filters explicitly reject shipment notices ("Amazon Order Shipped"),
 *   out-for-delivery updates, dispatch alerts, cancellations, or refunds.
 *
 * @param {string} text
 * @returns {{ amount: number, merchant: string } | null}
 */
function parseAmazon(text) {
  if (!/amazon/i.test(text)) return null;

  // Reject shipment updates, delivery notices, cancellations, and refunds
  if (/shipped|dispatch|out for delivery|delivered|refund|cancell?ed/i.test(text)) {
    return null;
  }

  // Must indicate a confirmed payment or charge
  if (!/(?:payment|paid|charged|receipt)/i.test(text)) {
    return null;
  }

  const patterns = [
    /(?:amount paid|total paid|payment of|charged):?\s*(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
    /Amazon(?:\.in)? order payment of (?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
    /Amazon Pay (?:transaction|payment).*?(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount) {
        return { amount, merchant: 'Amazon' };
      }
    }
  }

  return null;
}

/**
 * Parses Flipkart order payment confirmation emails.
 *
 * Synthetic Fixture Assumptions:
 * - Email confirms receipt of payment for a Flipkart order.
 * - Negative filters explicitly reject shipment updates, delivery notices,
 *   cancellations, or refunds.
 *
 * @param {string} text
 * @returns {{ amount: number, merchant: string } | null}
 */
function parseFlipkart(text) {
  if (!/flipkart/i.test(text)) return null;

  // Reject shipment updates, delivery notices, cancellations, and refunds
  if (/shipped|dispatch|out for delivery|delivered|refund|cancell?ed/i.test(text)) {
    return null;
  }

  // Must indicate a confirmed payment
  if (!/(?:payment|paid|receipt)/i.test(text)) {
    return null;
  }

  const patterns = [
    /(?:payment received|payment of|amount paid|total paid):?\s*(?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
    /Flipkart (?:order )?payment of (?:₹|Rs\.?|INR)\s*([\d,]+\.?\d*)/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount) {
        return { amount, merchant: 'Flipkart' };
      }
    }
  }

  return null;
}

/**
 * Registry of modular parser handlers. Evaluated in sequence until a parser
 * returns a normalized transaction extraction.
 */
const PARSER_REGISTRY = [
  { name: 'Swiggy Dineout', parse: parseSwiggyDineout },
  { name: 'Uber', parse: parseUber },
  { name: 'Ola', parse: parseOla },
  { name: 'Amazon', parse: parseAmazon },
  { name: 'Flipkart', parse: parseFlipkart },
];

/**
 * Main email parser entry point. Combines subject and body, iterates through the
 * parser registry, and returns normalized { amount, merchant } or null.
 *
 * @param {string} subject - Email subject line
 * @param {string} bodyText - Email body text
 * @returns {{ amount: number, merchant: string } | null}
 */
function parseEmail(subject, bodyText) {
  const text = `${subject || ''}\n${bodyText || ''}`;
  if (!text.trim()) return null;

  for (const { parse } of PARSER_REGISTRY) {
    const result = parse(text);
    if (result) {
      return result;
    }
  }

  return null;
}

module.exports = {
  parseEmail,
  PARSER_REGISTRY,
  parseSwiggyDineout,
  parseUber,
  parseOla,
  parseAmazon,
  parseFlipkart,
};
