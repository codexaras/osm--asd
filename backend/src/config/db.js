import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';

mongoose.set('strictQuery', true);

export const connectDB = async (uri = env.MONGO_URI, { retries = 10, delayMs = 3000 } = {}) => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      logger.info('MongoDB connected', { host: mongoose.connection.host, db: mongoose.connection.name });
      return mongoose.connection;
    } catch (err) {
      logger.warn('MongoDB connection failed', { attempt, retries, error: err.message });
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
};

export const disconnectDB = () => mongoose.disconnect();

export const dbState = () =>
  ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown';
