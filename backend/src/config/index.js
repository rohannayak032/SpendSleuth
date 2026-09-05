const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Search for .env file across standard project root and backend locations
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}
dotenv.config();

function parsePort(val, defaultPort = 3001) {
  if (!val) return defaultPort;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? defaultPort : parsed;
}

function requireConfig(key, value, featureName) {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    const context = featureName ? ` for ${featureName}` : '';
    throw new Error(
      `Configuration error: '${key}' is required${context}. Please check your environment variables or .env file.`
    );
  }
  return value;
}

function createConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';

  return {
    env: nodeEnv,
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    isTest: nodeEnv === 'test',
    port: parsePort(env.PORT, 3001),
    db: {
      path: env.DATABASE_PATH || path.resolve(__dirname, '../../expenses.db'),
    },
    gmail: {
      clientId: env.GMAIL_CLIENT_ID || '',
      clientSecret: env.GMAIL_CLIENT_SECRET || '',
      redirectUri: env.GMAIL_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback',
    },
    gemini: {
      apiKey: env.GEMINI_API_KEY || '',
    },
    requireConfig,
  };
}

const config = createConfig();

module.exports = config;
module.exports.createConfig = createConfig;
module.exports.requireConfig = requireConfig;
