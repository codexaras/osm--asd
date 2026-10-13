import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetBusinessCache } from '../src/metrics/metrics.js';
import { api, connectTestDB, dropTestDB, makeUser, makeResource } from './helpers.js';

describe('Prometheus /api/metrics endpoint', () => {
  before(() => connectTestDB('metrics'));
  after(() => dropTestDB());

  it('exposes HTTP, business and Node.js process metrics in Prometheus text format', async () => {
    const admin = await makeUser({ role: 'ADMIN' });
    await makeResource(admin.user);
    await api().get('/api/resources').set(admin.auth);
    await api().post('/api/auth/login').send({ email: 'nobody@test.local', password: 'nope' });
    resetBusinessCache();

    const res = await api().get('/api/metrics');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/plain/);
    const body = res.text;

    for (const metric of [
      'rh_http_requests_total',
      'rh_http_request_duration_seconds_bucket',
      'rh_http_requests_in_flight',
      'rh_logins_total',
      'rh_bookings_total',
      'rh_resources',
      'rh_resource_requests',
      'rh_asset_utilization_ratio',
      'rh_db_up 1',
      'rh_process_cpu_user_seconds_total',
      'rh_nodejs_heap_size_used_bytes'
    ]) {
      assert.ok(body.includes(metric), `missing metric ${metric}`);
    }
    assert.match(body, /rh_http_requests_total\{method="GET",route="\/api\/resources",status_code="200"/);
    assert.match(body, /rh_logins_total\{result="failure",app="resourcehub"\} [1-9]/);
    assert.match(body, /rh_resources\{status="AVAILABLE",category="Laptop",app="resourcehub"\} 1/);
  });

  it('labels unknown routes as "unmatched" to keep cardinality bounded', async () => {
    await api().get('/api/does-not-exist/123');
    const body = (await api().get('/api/metrics')).text;
    assert.match(body, /route="unmatched",status_code="404"/);
  });
});
