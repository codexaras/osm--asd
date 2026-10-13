import Allocation from '../models/Allocation.js';
import Resource from '../models/Resource.js';
import User from '../models/User.js';
import Maintenance from '../models/Maintenance.js';
import { badRequest, conflict, forbidden, notFound, requireFields } from '../utils/http.js';
import { events } from '../metrics/metrics.js';
import { isAdmin } from '../middleware/auth.js';
import { logActivity, notify, notifyAdmins } from './audit.service.js';

const populate = [
  { path: 'employee', select: 'name email department' },
  { path: 'resource', select: 'assetTag name category location status' },
  { path: 'allocatedBy', select: 'name' }
];

export const listAllocations = async (user, query = {}) => {
  const filter = isAdmin(user) ? {} : { employee: user._id };
  if (query.status) filter.status = query.status;
  if (isAdmin(user) && query.employeeId) filter.employee = query.employeeId;
  return Allocation.find(filter).populate(populate).sort({ createdAt: -1 });
};

/**
 * Core allocation primitive used both by request approval and direct allocation.
 * The conditional update (status: AVAILABLE -> ALLOCATED) is atomic in MongoDB,
 * which is what prevents the same asset being handed to two people.
 */
export const allocate = async ({ admin, resourceId, employeeId, dueDate, notes = '', requestId }) => {
  const employee = await User.findById(employeeId);
  if (!employee || !employee.isActive) throw badRequest('Employee not found or inactive');

  const resource = await Resource.findOneAndUpdate(
    { _id: resourceId, status: 'AVAILABLE', isShared: false },
    { $set: { status: 'ALLOCATED' } },
    { new: true }
  );
  if (!resource) {
    const exists = await Resource.findById(resourceId);
    if (!exists) throw notFound('Resource');
    if (exists.isShared) throw badRequest('Shared resources are booked, not allocated');
    throw conflict(`${exists.name} is not available (current status: ${exists.status})`);
  }

  const allocation = await Allocation.create({
    resource: resource._id,
    employee: employee._id,
    allocatedBy: admin._id,
    request: requestId,
    dueDate: dueDate || undefined,
    notes
  });

  events.allocations.inc({ action: 'allocated' });
  await notify(employee._id, 'ALLOCATION', `${resource.name} (${resource.assetTag}) has been allocated to you`);
  await logActivity(admin, 'ALLOCATE', 'Allocation', allocation._id, `${resource.assetTag} allocated to ${employee.name}`);
  return allocation.populate(populate);
};

export const directAllocate = async (admin, body) => {
  requireFields(body, ['resourceId', 'employeeId']);
  return allocate({ admin, resourceId: body.resourceId, employeeId: body.employeeId, dueDate: body.dueDate, notes: body.notes });
};

export const requestReturn = async (user, id, body = {}) => {
  const allocation = await Allocation.findById(id).populate('resource');
  if (!allocation) throw notFound('Allocation');
  if (String(allocation.employee) !== String(user._id)) throw forbidden('You can only return your own allocations');
  if (allocation.status !== 'ACTIVE') throw conflict(`Allocation is ${allocation.status.toLowerCase().replace('_', ' ')}`);
  allocation.status = 'RETURN_REQUESTED';
  if (body.note) allocation.notes = [allocation.notes, `Return note: ${body.note}`].filter(Boolean).join(' | ');
  await allocation.save();
  events.allocations.inc({ action: 'return_requested' });
  await notifyAdmins('ALLOCATION', `${user.name} wants to return ${allocation.resource.name} (${allocation.resource.assetTag})`);
  await logActivity(user, 'REQUEST_RETURN', 'Allocation', allocation._id, `Return requested for ${allocation.resource.assetTag}`);
  return allocation.populate(populate);
};

// Admin inspects the asset. DAMAGED returns go straight into maintenance.
export const confirmReturn = async (admin, id, body = {}) => {
  const allocation = await Allocation.findById(id).populate('resource');
  if (!allocation) throw notFound('Allocation');
  if (allocation.status === 'RETURNED') throw conflict('Allocation already returned');

  const condition = body.condition === 'DAMAGED' ? 'DAMAGED' : 'GOOD';
  allocation.status = 'RETURNED';
  allocation.returnedAt = new Date();
  allocation.returnCondition = condition;
  if (body.note) allocation.notes = [allocation.notes, `Inspection: ${body.note}`].filter(Boolean).join(' | ');
  await allocation.save();

  await Resource.updateOne(
    { _id: allocation.resource._id },
    { $set: { status: condition === 'DAMAGED' ? 'UNDER_MAINTENANCE' : 'AVAILABLE' } }
  );

  if (condition === 'DAMAGED') {
    await Maintenance.create({
      resource: allocation.resource._id,
      reportedBy: admin._id,
      issue: `Returned damaged by employee. ${body.note || ''}`.trim(),
      priority: 'HIGH',
      previousResourceStatus: 'AVAILABLE'
    });
    events.maintenance.inc({ priority: 'HIGH' });
  }

  events.allocations.inc({ action: 'returned' });
  await notify(allocation.employee, 'ALLOCATION', `Return of ${allocation.resource.name} confirmed (condition: ${condition})`);
  await logActivity(admin, 'CONFIRM_RETURN', 'Allocation', allocation._id, `${allocation.resource.assetTag} returned (${condition})`);
  return allocation.populate(populate);
};
