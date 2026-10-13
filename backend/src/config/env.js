import dotenv from 'dotenv';

dotenv.config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/resourcehub',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_only_change_me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:8080',
  SEED_ON_START: (process.env.SEED_ON_START || 'true') === 'true',
  BUSINESS_METRICS_TTL_MS: Number(process.env.BUSINESS_METRICS_TTL_MS) || 5000
};

if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'dev_only_change_me') {
  // Not fatal so the demo still boots, but loud enough to notice.
  console.warn('[env] WARNING: JWT_SECRET is using the development default. Set it in .env');
}

export default env;
