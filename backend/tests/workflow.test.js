import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Resource from '../src/models/Resource.js';
import ResourceRequest from '../src/models/ResourceRequest.js';
import { api, connectTestDB, dropTestDB, makeUser, makeResource } from './helpers.js';

describe('Request -> allocation -> return -> maintenance workflow', () => {
  let admin;
  let emp1;
  let emp2;

  before(async () => {
    await connectTestDB('workflow');
    admin = await makeUser({ role: 'ADMIN' });
    emp1 = await makeUser();
    emp2 = await makeUser();
  });
  after(() => dropTestDB());

  it('approving a request allocates the asset and auto-closes competing requests', async () => {
    const laptop = await makeResource(admin.user);
    const r1 = await api().post('/api/requests').set(emp1.auth).send({ resourceId: laptop._id, reason: 'Need it' });
    const r2 = await api().post('/api/requests').set(emp2.auth).send({ resourceId: laptop._id, reason: 'Me too' });
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);

    const approve = await api().patch(`/api/requests/${r1.body.data._id}/approve`).set(admin.auth).send({ note: 'ok' });
    assert.equal(approve.status, 200);
    assert.equal(approve.body.data.request.status, 'APPROVED');

    const fresh = await Resource.findById(laptop._id);
    assert.equal(fresh.status, 'ALLOCATED');
    const competing = await ResourceRequest.findById(r2.body.data._id);
    assert.equal(competing.status, 'REJECTED');
  });

  it('prevents allocating an asset that is already allocated (409)', async () => {
    const laptop = await makeResource(admin.user);
    const first = await api().post('/api/allocations').set(admin.auth).send({ resourceId: laptop._id, employeeId: emp1.user._id });
    assert.equal(first.status, 201);
    const second = await api().post('/api/allocations').set(admin.auth).send({ resourceId: laptop._id, employeeId: emp2.user._id });
    assert.equal(second.status, 409);
  });

  it('employees cannot request an asset that is not available', async () => {
    const laptop = await makeResource(admin.user, { status: 'UNDER_MAINTENANCE' });
    const res = await api().post('/api/requests').set(emp1.auth).send({ resourceId: laptop._id, reason: 'pls' });
    assert.equal(res.status, 409);
  });

  it('rejecting requires a reason', async () => {
    const laptop = await makeResource(admin.user);
    const r = await api().post('/api/requests').set(emp1.auth).send({ resourceId: laptop._id, reason: 'Need it' });
    const res = await api().patch(`/api/requests/${r.body.data._id}/reject`).set(admin.auth).send({});
    assert.equal(res.status, 400);
  });

  it('a GOOD return makes the asset AVAILABLE; a DAMAGED return opens a maintenance ticket', async () => {
    const a = await makeResource(admin.user);
    const b = await makeResource(admin.user);
    const allocA = await api().post('/api/allocations').set(admin.auth).send({ resourceId: a._id, employeeId: emp1.user._id });
    const allocB = await api().post('/api/allocations').set(admin.auth).send({ resourceId: b._id, employeeId: emp1.user._id });

    // Another employee cannot request the return of someone else's asset
    const notMine = await api().patch(`/api/allocations/${allocA.body.data._id}/return-request`).set(emp2.auth).send({});
    assert.equal(notMine.status, 403);

    await api().patch(`/api/allocations/${allocA.body.data._id}/return-request`).set(emp1.auth).send({ note: 'done' });
    const good = await api().patch(`/api/allocations/${allocA.body.data._id}/confirm-return`).set(admin.auth).send({ condition: 'GOOD' });
    assert.equal(good.status, 200);
    assert.equal((await Resource.findById(a._id)).status, 'AVAILABLE');

    await api().patch(`/api/allocations/${allocB.body.data._id}/confirm-return`).set(admin.auth).send({ condition: 'DAMAGED', note: 'cracked' });
    assert.equal((await Resource.findById(b._id)).status, 'UNDER_MAINTENANCE');
    const tickets = await api().get('/api/maintenance').set(admin.auth);
    assert.ok(tickets.body.data.some((t) => String(t.resource._id) === String(b._id) && t.priority === 'HIGH'));
  });

  it('reporting an issue takes the asset out of service and resolving restores it', async () => {
    const room = await makeResource(admin.user, { category: 'Meeting Room', isShared: true });
    const report = await api().post('/api/maintenance').set(emp1.auth).send({ resourceId: room._id, issue: 'AC broken', priority: 'HIGH' });
    assert.equal(report.status, 201);
    assert.equal((await Resource.findById(room._id)).status, 'UNDER_MAINTENANCE');

    const dup = await api().post('/api/maintenance').set(emp2.auth).send({ resourceId: room._id, issue: 'Still broken' });
    assert.equal(dup.status, 409);

    const resolve = await api().patch(`/api/maintenance/${report.body.data._id}`).set(admin.auth).send({ status: 'RESOLVED', resolutionNote: 'Fixed' });
    assert.equal(resolve.status, 200);
    assert.equal((await Resource.findById(room._id)).status, 'AVAILABLE');
  });

  it('employees can only report issues on shared resources or their own assets', async () => {
    const laptop = await makeResource(admin.user);
    const res = await api().post('/api/maintenance').set(emp2.auth).send({ resourceId: laptop._id, issue: 'Not mine' });
    assert.equal(res.status, 403);
  });
});
