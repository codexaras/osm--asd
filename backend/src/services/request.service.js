import ResourceRequest from '../models/ResourceRequest.js';
import Resource from '../models/Resource.js';
import { badRequest, conflict, forbidden, notFound, requireFields } from '../utils/http.js';
import { events } from '../metrics/metrics.js';
import { isAdmin } from '../middleware/auth.js';
import { logActivity, notify, notifyAdmins } from './audit.service.js';
import { allocate } from './allocation.service.js';

const populate = [
  { path: 'employee', select: 'name email department' },
  { path: 'resource', select: 'assetTag name category location status' },
  { path: 'reviewedBy', select: 'name' }
];

export const listRequests = async (user, query = {}) => {
  const filter = isAdmin(user) ? {} : { employee: user._id };
  if (query.status) filter.status = query.status;
  return ResourceRequest.find(filter).populate(populate).sort({ createdAt: -1 });
};

export const createRequest = async (user, body) => {
  requireFields(body, ['resourceId', 'reason']);
  const resource = await Resource.findById(body.resourceId);
  if (!resource) throw notFound('Resource');
  if (resource.isShared) throw badRequest('Shared resources (rooms, projectors) are booked, not requested');
  if (resource.status !== 'AVAILABLE') throw conflict(`${resource.name} is currently ${resource.status.replace('_', ' ').toLowerCase()}`);

  const duplicate = await ResourceRequest.exists({ employee: user._id, resource: resource._id, status: 'PENDING' });
  if (duplicate) throw conflict('You already have a pending request for this resource');

  const request = await ResourceRequest.create({
    employee: user._id,
    resource: resource._id,
    reason: body.reason,
    neededUntil: body.neededUntil || undefined
  });
  events.requests.inc({ action: 'created' });
  await notifyAdmins('REQUEST', `${user.name} requested ${resource.name} (${resource.assetTag})`);
  await logActivity(user, 'CREATE_REQUEST', 'ResourceRequest', request._id, `${user.name} requested ${resource.assetTag}`);
  return request.populate(populate);
};

const loadPending = async (id) => {
  const request = await ResourceRequest.findById(id).populate('resource');
  if (!request) throw notFound('Request');
  if (request.status !== 'PENDING') throw conflict(`Request is already ${request.status.toLowerCase()}`);
  return request;
};

export const approveRequest = async (admin, id, body = {}) => {
  const request = await loadPending(id);
  // allocate() flips the resource AVAILABLE -> ALLOCATED atomically, so two approvals can't both win.
  const allocation = await allocate({
    admin,
    resourceId: request.resource._id,
    employeeId: request.employee,
    dueDate: body.dueDate || request.neededUntil,
    notes: body.note || '',
    requestId: request._id
  });

  request.status = 'APPROVED';
  request.reviewedBy = admin._id;
  request.reviewedAt = new Date();
  request.reviewNote = body.note || '';
  await request.save();

  // Any other pending requests for the same asset can no longer be fulfilled.
  const others = await ResourceRequest.find({ resource: request.resource._id, status: 'PENDING', _id: { $ne: request._id } });
  for (const other of others) {
    other.status = 'REJECTED';
    other.reviewedBy = admin._id;
    other.reviewedAt = new Date();
    other.reviewNote = 'Asset was allocated to another employee';
    await other.save();
    events.requests.inc({ action: 'rejected' });
    await notify(other.employee, 'REQUEST', `Your request for ${request.resource.name} was closed: asset allocated to someone else`);
  }

  events.requests.inc({ action: 'approved' });
  await notify(request.employee, 'REQUEST', `Your request for ${request.resource.name} was approved`);
  await logActivity(admin, 'APPROVE_REQUEST', 'ResourceRequest', request._id, `Approved ${request.resource.assetTag}`);
  return { request: await request.populate(populate), allocation };
};

export const rejectRequest = async (admin, id, body = {}) => {
  if (!body.note) throw badRequest('A rejection reason is required');
  const request = await loadPending(id);
  request.status = 'REJECTED';
  request.reviewedBy = admin._id;
  request.reviewedAt = new Date();
  request.reviewNote = body.note;
  await request.save();
  events.requests.inc({ action: 'rejected' });
  await notify(request.employee, 'REQUEST', `Your request for ${request.resource.name} was rejected: ${body.note}`);
  await logActivity(admin, 'REJECT_REQUEST', 'ResourceRequest', request._id, `Rejected ${request.resource.assetTag}`);
  return request.populate(populate);
};

export const cancelRequest = async (user, id) => {
  const request = await loadPending(id);
  if (String(request.employee) !== String(user._id)) throw forbidden('You can only cancel your own requests');
  request.status = 'CANCELLED';
  await request.save();
  events.requests.inc({ action: 'cancelled' });
  await logActivity(user, 'CANCEL_REQUEST', 'ResourceRequest', request._id, `${user.name} cancelled request for ${request.resource.assetTag}`);
  return request.populate(populate);
};
