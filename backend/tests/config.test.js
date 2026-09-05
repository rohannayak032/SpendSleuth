const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const config = require('../src/config');
const { createConfig, requireConfig } = require('../src/config');

describe('Configuration module', () => {
  describe('Default configuration', () => {
    test('should provide sensible defaults when environment variables are empty', () => {
      const customConfig = createConfig({});

      assert.strictEqual(customConfig.env, 'development');
      assert.strictEqual(customConfig.isDevelopment, true);
      assert.strictEqual(customConfig.isProduction, false);
      assert.strictEqual(customConfig.isTest, false);
      assert.strictEqual(customConfig.port, 3001);
      assert.ok(customConfig.db.path.endsWith('expenses.db'));
      assert.strictEqual(customConfig.gmail.clientId, '');
      assert.strictEqual(customConfig.gmail.clientSecret, '');
      assert.strictEqual(
        customConfig.gmail.redirectUri,
        'http://localhost:3001/api/auth/google/callback'
      );
      assert.strictEqual(customConfig.gemini.apiKey, '');
    });

    test('should expose singleton config object with expected properties', () => {
      assert.ok(typeof config.env === 'string');
      assert.ok(typeof config.port === 'number');
      assert.ok(typeof config.db.path === 'string');
      assert.ok(typeof config.gmail === 'object');
      assert.ok(typeof config.gemini === 'object');
      assert.ok(typeof config.requireConfig === 'function');
    });
  });

  describe('Custom environment variable parsing', () => {
    test('should parse custom environment variables accurately', () => {
      const mockEnv = {
        NODE_ENV: 'production',
        PORT: '8080',
        DATABASE_PATH: '/tmp/test-expenses.db',
        GMAIL_CLIENT_ID: 'mock-client-id',
        GMAIL_CLIENT_SECRET: 'mock-client-secret',
        GMAIL_REDIRECT_URI: 'https://example.com/oauth/callback',
        GEMINI_API_KEY: 'mock-gemini-key',
      };

      const customConfig = createConfig(mockEnv);

      assert.strictEqual(customConfig.env, 'production');
      assert.strictEqual(customConfig.isProduction, true);
      assert.strictEqual(customConfig.isDevelopment, false);
      assert.strictEqual(customConfig.isTest, false);
      assert.strictEqual(customConfig.port, 8080);
      assert.strictEqual(customConfig.db.path, '/tmp/test-expenses.db');
      assert.strictEqual(customConfig.gmail.clientId, 'mock-client-id');
      assert.strictEqual(customConfig.gmail.clientSecret, 'mock-client-secret');
      assert.strictEqual(
        customConfig.gmail.redirectUri,
        'https://example.com/oauth/callback'
      );
      assert.strictEqual(customConfig.gemini.apiKey, 'mock-gemini-key');
    });

    test('should fallback port to default when PORT is non-numeric', () => {
      const customConfig = createConfig({ PORT: 'not-a-number' });
      assert.strictEqual(customConfig.port, 3001);
    });

    test('should set isTest to true when NODE_ENV is test', () => {
      const customConfig = createConfig({ NODE_ENV: 'test' });
      assert.strictEqual(customConfig.isTest, true);
      assert.strictEqual(customConfig.isDevelopment, false);
      assert.strictEqual(customConfig.isProduction, false);
    });
  });

  describe('requireConfig validation helper', () => {
    test('should return value when value is present and non-empty', () => {
      const validKey = requireConfig('API_KEY', 'secret-value-123', 'API Service');
      assert.strictEqual(validKey, 'secret-value-123');
    });

    test('should throw descriptive error when required key is missing or empty', () => {
      assert.throws(
        () => requireConfig('GEMINI_API_KEY', '', 'LLM extraction'),
        /Configuration error: 'GEMINI_API_KEY' is required for LLM extraction/
      );

      assert.throws(
        () => requireConfig('GMAIL_CLIENT_ID', null, 'Gmail OAuth'),
        /Configuration error: 'GMAIL_CLIENT_ID' is required for Gmail OAuth/
      );

      assert.throws(
        () => requireConfig('DATABASE_URL', undefined),
        /Configuration error: 'DATABASE_URL' is required\./
      );

      assert.throws(
        () => requireConfig('WHITESPACE_KEY', '   ', 'Service'),
        /Configuration error: 'WHITESPACE_KEY' is required for Service/
      );
    });
  });
});
