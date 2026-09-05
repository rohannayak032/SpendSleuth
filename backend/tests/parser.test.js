const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseEmail } = require('../src/services/parser');

describe('parseEmail', () => {
  describe('Swiggy Dineout pattern matching', () => {
    test('should extract amount and merchant when pattern is in subject', () => {
      const subject = 'Swiggy Dineout payment of Rs. 450.00';
      const body = 'Thank you for dining with us at Cafe Mocha.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 450.0,
        merchant: 'Swiggy',
      });
    });

    test('should extract amount and merchant when pattern is in body text', () => {
      const subject = 'Receipt for your dining payment';
      const body = 'Your Swiggy Dineout payment of Rs. 1,250.50 was successful.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 1250.5,
        merchant: 'Swiggy',
      });
    });

    test('should handle amount without spaces after Rs.', () => {
      const subject = 'Swiggy Dineout payment of Rs.350';
      const body = 'Payment processed.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 350,
        merchant: 'Swiggy',
      });
    });

    test('should handle amounts with commas and decimals', () => {
      const subject = 'Swiggy Dineout payment of Rs. 12,450.75';
      const body = 'Transaction complete.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 12450.75,
        merchant: 'Swiggy',
      });
    });

    test('should handle amounts formatted with Indian numbering system commas', () => {
      const subject = 'Confirmation';
      const body = 'Swiggy Dineout payment of Rs. 1,00,500.00 has been debited.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 100500,
        merchant: 'Swiggy',
      });
    });

    test('should match case-insensitively', () => {
      const subject = 'swiggy dineout payment of rs. 500.00';
      const body = 'Transaction successful';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 500,
        merchant: 'Swiggy',
      });
    });

    test('should match UPPERCASE pattern', () => {
      const subject = 'SWIGGY DINEOUT PAYMENT OF RS. 750.25';
      const body = 'RECEIPT';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 750.25,
        merchant: 'Swiggy',
      });
    });
  });

  describe('Non-matching and edge cases', () => {
    test('should return null for unrelated emails', () => {
      const result1 = parseEmail('Your OTP is 123456', 'Do not share this OTP.');
      assert.strictEqual(result1, null);

      const result2 = parseEmail('Amazon Order Shipped', 'Your order total was Rs. 899.');
      assert.strictEqual(result2, null);

      const result3 = parseEmail('Swiggy Food Delivery', 'Your food from Burger King is on the way.');
      assert.strictEqual(result3, null);
    });

    test('should return null for empty subject and body', () => {
      const result = parseEmail('', '');
      assert.strictEqual(result, null);
    });

    test('should return null when pattern has no amount number', () => {
      const result = parseEmail('Swiggy Dineout payment of Rs. ', 'Failed transaction');
      assert.strictEqual(result, null);
    });
  });
});
