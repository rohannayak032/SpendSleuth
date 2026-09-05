const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { categorize } = require('../src/services/categorizer');

describe('categorize', () => {
  describe('Food category', () => {
    test('should categorize food delivery and restaurant merchants', () => {
      assert.strictEqual(categorize('swiggy'), 'Food');
      assert.strictEqual(categorize('Swiggy Dineout'), 'Food');
      assert.strictEqual(categorize('SWIGGY INSTAMART'), 'Food');
      assert.strictEqual(categorize('zomato'), 'Food');
      assert.strictEqual(categorize('Zomato Limited'), 'Food');
      assert.strictEqual(categorize('dominos'), 'Food');
      assert.strictEqual(categorize('Dominos Pizza'), 'Food');
      assert.strictEqual(categorize('burgerking'), 'Food');
      assert.strictEqual(categorize('BurgerKing India'), 'Food');
      assert.strictEqual(categorize('pizzahut'), 'Food');
      assert.strictEqual(categorize('PizzaHut Store'), 'Food');
    });
  });

  describe('Transport category', () => {
    test('should categorize rideshare and cab services', () => {
      assert.strictEqual(categorize('uber'), 'Transport');
      assert.strictEqual(categorize('Uber India Systems'), 'Transport');
      assert.strictEqual(categorize('UBER TRIP'), 'Transport');
      assert.strictEqual(categorize('ola'), 'Transport');
      assert.strictEqual(categorize('Ola Cabs'), 'Transport');
      assert.strictEqual(categorize('ANI TECHNOLOGIES OLA'), 'Transport');
    });
  });

  describe('Shopping category', () => {
    test('should categorize e-commerce platforms', () => {
      assert.strictEqual(categorize('amazon'), 'Shopping');
      assert.strictEqual(categorize('Amazon Seller Services'), 'Shopping');
      assert.strictEqual(categorize('AMAZON PAY'), 'Shopping');
      assert.strictEqual(categorize('flipkart'), 'Shopping');
      assert.strictEqual(categorize('Flipkart Internet Private Limited'), 'Shopping');
      assert.strictEqual(categorize('myntra'), 'Shopping');
      assert.strictEqual(categorize('Myntra Designs'), 'Shopping');
      assert.strictEqual(categorize('ajio'), 'Shopping');
      assert.strictEqual(categorize('Ajio Online'), 'Shopping');
      assert.strictEqual(categorize('meesho'), 'Shopping');
      assert.strictEqual(categorize('Meesho Payments'), 'Shopping');
    });
  });

  describe('Bills & Utilities category', () => {
    test('should categorize telecom and utility providers', () => {
      assert.strictEqual(categorize('airtel'), 'Bills & Utilities');
      assert.strictEqual(categorize('Airtel Prepaid Recharge'), 'Bills & Utilities');
      assert.strictEqual(categorize('jio'), 'Bills & Utilities');
      assert.strictEqual(categorize('Reliance Jio Infocomm'), 'Bills & Utilities');
      assert.strictEqual(categorize('vodafone'), 'Bills & Utilities');
      assert.strictEqual(categorize('Vodafone Idea Limited'), 'Bills & Utilities');
    });
  });

  describe('Health category', () => {
    test('should categorize healthcare and pharmacy merchants', () => {
      assert.strictEqual(categorize('apollo'), 'Health');
      assert.strictEqual(categorize('Apollo Pharmacy'), 'Health');
      assert.strictEqual(categorize('pharmacy'), 'Health');
      assert.strictEqual(categorize('City Pharmacy'), 'Health');
      assert.strictEqual(categorize('medplus'), 'Health');
      assert.strictEqual(categorize('MedPlus Health Services'), 'Health');
    });
  });

  describe('Fallback and edge cases', () => {
    test('should fallback to General category for unknown merchants', () => {
      assert.strictEqual(categorize('Netflix'), 'General');
      assert.strictEqual(categorize('Spotify'), 'General');
      assert.strictEqual(categorize('Local Kirana Store'), 'General');
      assert.strictEqual(categorize('Unknown Vendor 123'), 'General');
    });

    test('should return General for empty string', () => {
      assert.strictEqual(categorize(''), 'General');
    });
  });
});
