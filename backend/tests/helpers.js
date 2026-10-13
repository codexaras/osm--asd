import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Resource from '../src/models/Resource.js';

process.env.NODE_ENV = 'test';

export const api = () => request(app);

// Each test file gets its own throw-away database.
export const connectTestDB = async (suffix) => {
  const base = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/resourcehub';
  const url = new URL(base);
  url.pathname = `/rh_test_${suffix}_${Date.now().toString(36)}`;
  await mongoose.connect(url.toString(), { serverSelectionTimeoutMS: 5000 });
};

export const dropTestDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};

export const makeUser = async (overrides = {}) => {
  const n = Math.random().toString(36).slice(2, 8);
  const password = 'Password@123';
  const user = await User.create({ name: `User ${n}`, email: `u${n}@test.local`, password, role: 'EMPLOYEE', ...overrides });
  const res = await api().post('/api/auth/login').send({ email: user.email, password });
  return { user, token: res.body.data.token, auth: { Authorization: `Bearer ${res.body.data.token}` } };
};

export const makeResource = (admin, overrides = {}) => {
  const n = Math.random().toString(36).slice(2, 7).toUpperCase();
  return Resource.create({
    assetTag: `T-${n}`,
    name: `Test asset ${n}`,
    category: 'Laptop',
    location: 'Test lab',
    createdBy: admin._id,
    ...overrides
  });
};

// Returns an ISO string `hours` from now (rounded to the hour) so bookings are always in the future.
export const slot = (dayOffset, hour) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dayOffset);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
