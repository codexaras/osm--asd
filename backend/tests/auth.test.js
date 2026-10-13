import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, connectTestDB, dropTestDB, makeUser } from './helpers.js';

describe('Authentication & RBAC', () => {
  before(() => connectTestDB('auth'));
  after(() => dropTestDB());

  it('health endpoint reports UP with database connected', async () => {
    const res = await api().get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'UP');
    assert.equal(res.body.database, 'connected');
  });

  it('public sign-up always creates an EMPLOYEE, even if ADMIN is requested', async () => {
    const res = await api()
      .post('/api/auth/signup')
      .send({ name: 'Mallory', email: 'mallory@test.local', password: 'secret123', role: 'ADMIN' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'EMPLOYEE');
    assert.equal(res.body.data.user.password, undefined, 'password hash must never be returned');
    assert.ok(res.body.data.token);
  });

  it('rejects duplicate e-mail on sign-up with 409', async () => {
    const res = await api().post('/api/auth/signup').send({ name: 'Dup', email: 'mallory@test.local', password: 'secret123' });
    assert.equal(res.status, 409);
  });

  it('rejects a wrong password with 401', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'mallory@test.local', password: 'wrong-pass' });
    assert.equal(res.status, 401);
  });

  it('returns 401 for protected routes without a token', async () => {
    const res = await api().get('/api/resources');
    assert.equal(res.status, 401);
  });

  it('returns 403 when an employee calls an admin-only endpoint', async () => {
    const { auth } = await makeUser();
    const res = await api()
      .post('/api/resources')
      .set(auth)
      .send({ assetTag: 'X-1', name: 'Hack', category: 'Laptop', location: 'Nowhere' });
    assert.equal(res.status, 403);
  });

  it('blocks deactivated accounts from logging in', async () => {
    const { user } = await makeUser();
    user.isActive = false;
    await user.save();
    const res = await api().post('/api/auth/login').send({ email: user.email, password: 'Password@123' });
    assert.equal(res.status, 401);
  });
});
