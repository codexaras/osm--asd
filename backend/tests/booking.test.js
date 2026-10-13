import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { overlaps } from '../src/services/booking.service.js';
import { api, connectTestDB, dropTestDB, makeUser, makeResource, slot } from './helpers.js';

describe('Booking overlap rule (pure function)', () => {
  const t = (h) => new Date(Date.UTC(2030, 0, 1, h));
  it('detects partial and full overlaps', () => {
    assert.equal(overlaps(t(10), t(12), t(11), t(13)), true);
    assert.equal(overlaps(t(10), t(12), t(9), t(13)), true);
    assert.equal(overlaps(t(10), t(12), t(10), t(12)), true);
  });
  it('treats back-to-back slots as free', () => {
    assert.equal(overlaps(t(10), t(11), t(11), t(12)), false);
    assert.equal(overlaps(t(11), t(12), t(10), t(11)), false);
  });
});

describe('Booking API', () => {
  let admin;
  let emp;
  let other;
  let room;

  before(async () => {
    await connectTestDB('booking');
    admin = await makeUser({ role: 'ADMIN' });
    emp = await makeUser();
    other = await makeUser();
    room = await makeResource(admin.user, { category: 'Meeting Room', isShared: true, capacity: 6 });
  });
  after(() => dropTestDB());

  const book = (who, start, end, extra = {}) =>
    api().post('/api/bookings').set(who.auth).send({ resourceId: room._id, purpose: 'Test meeting', startAt: start, endAt: end, ...extra });

  it('confirms a free slot', async () => {
    const res = await book(emp, slot(2, 10), slot(2, 11));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'CONFIRMED');
  });

  it('rejects an overlapping slot with 409', async () => {
    const res = await book(other, slot(2, 10), slot(2, 12));
    assert.equal(res.status, 409);
    assert.match(res.body.message, /already booked/);
  });

  it('accepts an adjacent slot (11:00-12:00 after 10:00-11:00)', async () => {
    const res = await book(other, slot(2, 11), slot(2, 12));
    assert.equal(res.status, 201);
  });

  it('validates end > start, no past bookings and room capacity', async () => {
    assert.equal((await book(emp, slot(3, 12), slot(3, 11))).status, 400);
    assert.equal((await book(emp, slot(-1, 10), slot(-1, 11))).status, 400);
    assert.equal((await book(emp, slot(3, 9), slot(3, 10), { attendees: 50 })).status, 400);
  });

  it('cannot book a non-shared asset', async () => {
    const laptop = await makeResource(admin.user);
    const res = await api()
      .post('/api/bookings')
      .set(emp.auth)
      .send({ resourceId: laptop._id, purpose: 'x', startAt: slot(4, 10), endAt: slot(4, 11) });
    assert.equal(res.status, 400);
  });

  it('only the owner or an admin can cancel; cancelling frees the slot', async () => {
    const created = await book(emp, slot(5, 14), slot(5, 15));
    const id = created.body.data._id;
    assert.equal((await api().patch(`/api/bookings/${id}/cancel`).set(other.auth)).status, 403);
    assert.equal((await api().patch(`/api/bookings/${id}/cancel`).set(emp.auth)).status, 200);
    assert.equal((await book(other, slot(5, 14), slot(5, 15))).status, 201);
  });
});
