const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseEmail,
  PARSER_REGISTRY,
  parseSwiggyDineout,
  parseUber,
  parseOla,
  parseAmazon,
  parseFlipkart,
} = require('../src/services/parser');

describe('parseEmail and modular parsers', () => {
  describe('Swiggy Dineout pattern matching (backward compatibility)', () => {
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

  describe('Uber ride receipt parsing', () => {
    // Synthetic fixture: Completed Uber trip receipt with Total charge
    test('should parse confirmed Uber trip receipt with rupee symbol (₹)', () => {
      const subject = 'Your Monday evening trip with Uber';
      const body = 'Thanks for riding with us. Total: ₹342.50. Paid via Uber Pay.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 342.5,
        merchant: 'Uber',
      });
    });

    test('should parse Uber receipt with Rs. and comma-separated amount', () => {
      const subject = 'Uber trip receipt';
      const body = 'Here is your receipt for your ride. Trip fare: Rs. 1,250.00 paid.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 1250,
        merchant: 'Uber',
      });
    });

    test('should parse Uber receipt with integer amount and INR symbol', () => {
      const subject = 'Your trip with Uber';
      const body = 'Ride completed. Total paid: INR 280. Cash collected.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 280,
        merchant: 'Uber',
      });
    });

    test('should reject Uber ride estimates (not a completed expense)', () => {
      const subject = 'Uber ride estimate';
      const body = 'Estimated fare for your upcoming trip: Rs. 250 - Rs. 320.';
      assert.strictEqual(parseEmail(subject, body), null);
    });

    test('should reject Uber scheduled ride alerts', () => {
      const subject = 'Your scheduled ride with Uber';
      const body = 'Your trip is scheduled for 8:00 AM. Estimated total: Rs. 400.';
      assert.strictEqual(parseEmail(subject, body), null);
    });

    test('should reject Uber cancellation alerts', () => {
      const subject = 'Your Uber ride was cancelled';
      const body = 'You were not charged for this trip. Total: Rs. 0.';
      assert.strictEqual(parseEmail(subject, body), null);
    });

    test('should reject Uber driver arrival alerts', () => {
      const subject = 'Your driver is arriving';
      const body = 'Ramesh is arriving in a Swift Dzire. Get ready for your ride.';
      assert.strictEqual(parseEmail(subject, body), null);
    });
  });

  describe('Ola ride invoice parsing', () => {
    // Synthetic fixture: Completed Ola ride invoice with CRN number
    test('should parse confirmed Ola ride invoice with rupee symbol (₹)', () => {
      const subject = 'Your Ola ride invoice [CRN8912345]';
      const body = 'Here is your ride summary for trip CRN8912345. Total Bill: ₹420.00. Payment method: Cash.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 420,
        merchant: 'Ola',
      });
    });

    test('should parse Ola invoice with Total Payable and commas', () => {
      const subject = 'Ola Ride Invoice';
      const body = 'Thanks for riding with Ola. Total Payable: Rs. 1,150.75 debited via UPI.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 1150.75,
        merchant: 'Ola',
      });
    });

    test('should parse Ola invoice with integer amount', () => {
      const subject = 'CRN9876543 Ola Invoice';
      const body = 'Trip completed. Total Fare: Rs. 185.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 185,
        merchant: 'Ola',
      });
    });

    test('should reject Ola booking confirmation / driver-on-the-way alerts', () => {
      const subject = 'Ola booking confirmed';
      const body = 'Driver is on the way for CRN12345. Estimated fare: Rs. 350.';
      assert.strictEqual(parseEmail(subject, body), null);
    });

    test('should reject Ola ride fare estimates', () => {
      const subject = 'Ola fare estimate for your route';
      const body = 'Estimated ride fare: Rs. 200 - Rs. 250.';
      assert.strictEqual(parseEmail(subject, body), null);
    });

    test('should reject Ola ride cancellation notices', () => {
      const subject = 'Your Ola ride CRN123 has been cancelled';
      const body = 'Trip cancelled by rider.';
      assert.strictEqual(parseEmail(subject, body), null);
    });
  });

  describe('Amazon confirmed order payment parsing', () => {
    // Synthetic fixture: Confirmed payment for Amazon order or Amazon Pay transaction
    test('should parse confirmed Amazon order payment receipt with Rs.', () => {
      const subject = 'Payment confirmation for your Amazon order';
      const body = 'Thank you for your order. Amount Paid: Rs. 1,499.00 via Amazon Pay UPI.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 1499,
        merchant: 'Amazon',
      });
    });

    test('should parse Amazon order payment with ₹ and decimals', () => {
      const subject = 'Your Amazon.in order payment confirmation';
      const body = 'Your Amazon.in order payment of ₹2,249.50 was successful.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 2249.5,
        merchant: 'Amazon',
      });
    });

    test('should parse Amazon Pay transaction receipt with comma-separated amount', () => {
      const subject = 'Amazon Pay transaction receipt';
      const body = 'Amazon Pay payment of Rs. 12,850.00 was successful to Merchant Store.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 12850,
        merchant: 'Amazon',
      });
    });

    test('should reject Amazon shipment notifications (not a confirmed payment)', () => {
      const subject = 'Amazon Order Shipped';
      const body = 'Your order total was Rs. 899. Package has left our facility.';
      assert.strictEqual(parseEmail(subject, body), null);
    });

    test('should reject Amazon out-for-delivery notifications', () => {
      const subject = 'Your Amazon package is out for delivery';
      const body = 'Your order of Rs. 1,299 will be delivered today by 8 PM.';
      assert.strictEqual(parseEmail(subject, body), null);
    });

    test('should reject Amazon refund notices', () => {
      const subject = 'Refund processed for your Amazon order';
      const body = 'We have initiated a refund of Rs. 500 to your bank account.';
      assert.strictEqual(parseEmail(subject, body), null);
    });
  });

  describe('Flipkart confirmed order payment parsing', () => {
    // Synthetic fixture: Confirmed payment for Flipkart order
    test('should parse Flipkart payment confirmation with Rs. and decimals', () => {
      const subject = 'Payment received for your Flipkart order';
      const body = 'We have received your payment of Rs. 2,499.50 for order OD123456789. Thank you for shopping with Flipkart!';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 2499.5,
        merchant: 'Flipkart',
      });
    });

    test('should parse Flipkart payment confirmation with ₹ and comma-separated amounts', () => {
      const subject = 'Flipkart order payment confirmation';
      const body = 'Flipkart order payment of ₹14,999.00 has been confirmed.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 14999,
        merchant: 'Flipkart',
      });
    });

    test('should parse Flipkart payment with Amount Paid phrasing', () => {
      const subject = 'Payment Confirmation - Flipkart';
      const body = 'Your order OD999 is confirmed. Amount paid: Rs. 799 via Net Banking.';
      const result = parseEmail(subject, body);

      assert.deepStrictEqual(result, {
        amount: 799,
        merchant: 'Flipkart',
      });
    });

    test('should reject Flipkart shipment notifications (not a payment receipt)', () => {
      const subject = 'Your Flipkart order has been shipped';
      const body = 'Your item for order OD1234 has been dispatched. Order value: Rs. 1,499.';
      assert.strictEqual(parseEmail(subject, body), null);
    });

    test('should reject Flipkart delivery updates', () => {
      const subject = 'Your Flipkart package is out for delivery';
      const body = 'Expected delivery by today. Total was Rs. 899.';
      assert.strictEqual(parseEmail(subject, body), null);
    });

    test('should reject Flipkart order cancellations', () => {
      const subject = 'Flipkart order cancelled';
      const body = 'Your order OD123 has been cancelled. Amount: Rs. 500.';
      assert.strictEqual(parseEmail(subject, body), null);
    });
  });

  describe('Non-matching and edge cases', () => {
    test('should return null for unrelated emails', () => {
      const result1 = parseEmail('Your OTP is 123456', 'Do not share this OTP.');
      assert.strictEqual(result1, null);

      const result2 = parseEmail('Swiggy Food Delivery', 'Your food from Burger King is on the way.');
      assert.strictEqual(result2, null);

      const result3 = parseEmail('Netflix Subscription', 'Your next billing date is Oct 20.');
      assert.strictEqual(result3, null);
    });

    test('should return null for empty subject and body', () => {
      assert.strictEqual(parseEmail('', ''), null);
      assert.strictEqual(parseEmail(null, null), null);
      assert.strictEqual(parseEmail(undefined, undefined), null);
    });

    test('should return null when pattern has no amount number', () => {
      assert.strictEqual(parseEmail('Swiggy Dineout payment of Rs. ', 'Failed transaction'), null);
      assert.strictEqual(parseEmail('Payment confirmation for your Amazon order', 'Amount Paid: Rs. '), null);
      assert.strictEqual(parseEmail('Uber trip receipt', 'Total: ₹'), null);
      assert.strictEqual(parseEmail('Ola ride invoice', 'Total Bill: Rs.'), null);
    });
  });

  describe('Parser registry inspection', () => {
    test('should expose individual modular parser functions and the registry', () => {
      assert.ok(Array.isArray(PARSER_REGISTRY));
      assert.strictEqual(PARSER_REGISTRY.length, 5);
      const names = PARSER_REGISTRY.map((p) => p.name);
      assert.deepStrictEqual(names, ['Swiggy Dineout', 'Uber', 'Ola', 'Amazon', 'Flipkart']);

      assert.strictEqual(typeof parseSwiggyDineout, 'function');
      assert.strictEqual(typeof parseUber, 'function');
      assert.strictEqual(typeof parseOla, 'function');
      assert.strictEqual(typeof parseAmazon, 'function');
      assert.strictEqual(typeof parseFlipkart, 'function');
    });
  });
});
