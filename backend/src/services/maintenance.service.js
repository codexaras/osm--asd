import Maintenance, { PRIORITIES, TICKET_STATUS } from '../models/Maintenance.js';
import Resource from '../models/Resource.js';
import Allocation from '../models/Allocation.js';
import { badRequest, conflict, forbidden, notFound, requireFields } from '../utils/http.js';
import { events } from '../metrics/metrics.js';
import { isAdmin } from '../middleware/auth.js';
import { logActivity, notify, notifyAdmins } from './audit.service.js';

const populate = [
  { path: 'resource', select: 'assetTag name category location status' },
  { path: 'reportedBy', select: 'name email' }
];

export const listTickets = async (user, query = {}) => {
  const filter = isAdmin(user) ? {} : { reportedBy: user._id };
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  return Maintenance.find(filter).populate(populate).sort({ createdAt: -1 });
};

export const reportIssue = async (user, body) => {
  requireFields(body, ['resourceId', 'issue']);
  if (body.priority && !PRIORITIES.includes(body.priority)) throw badRequest('Invalid priority');
  const resource = await Resource.findById(body.resourceId);
  if (!resource) throw notFound('Resource');

  // Employees may only report shared resources or assets allocated to them.
  if (!isAdmin(user) && !resource.isShared) {
    const mine = await Allocation.exists({ resource: resource._id, employee: user._id, status: { $in: ['ACTIVE', 'RETURN_REQUESTED'] } });
    if (!mine) throw forbidden('You can only report issues for shared resources or assets allocated to you');
  }
  if (await Maintenance.exists({ resource: resource._id, status: { $ne: 'RESOLVED' } })) {
    throw conflict('An open maintenance ticket already exists for this resource');
  }

  const ticket = await Maintenance.create({
    resource: resource._id,
    reportedBy: user._id,
    issue: body.issue,
    priority: body.priority || 'MEDIUM',
    previousResourceStatus: resource.status === 'UNDER_MAINTENANCE' ? 'AVAILABLE' : resource.status
  });
  resource.status = 'UNDER_MAINTENANCE';
  await resource.save();

  events.maintenance.inc({ priority: ticket.priority });
  await notifyAdmins('MAINTENANCE', `[${ticket.priority}] ${resource.name}: ${body.issue}`);
  await logActivity(user, 'REPORT_ISSUE', 'Maintenance', ticket._id, `${ticket.ticketNo} raised for ${resource.assetTag}`);
  return ticket.populate(populate);
};

export const updateTicket = async (admin, id, body = {}) => {
  const ticket = await Maintenance.findById(id).populate('resource');
  if (!ticket) throw notFound('Ticket');
  if (body.status && !TICKET_STATUS.includes(body.status)) throw badRequest('Invalid status');
  if (ticket.status === 'RESOLVED') throw conflict('Ticket is already resolved');
  if (body.priority) {
    if (!PRIORITIES.includes(body.priority)) throw badRequest('Invalid priority');
    ticket.priority = body.priority;
  }
  if (body.status) ticket.status = body.status;
  if (body.resolutionNote) ticket.resolutionNote = body.resolutionNote;

  if (ticket.status === 'RESOLVED') {
    ticket.resolvedAt = new Date();
    // Restore the asset to whatever it was before (an allocated laptop stays with its owner).
    const stillAllocated = await Allocation.exists({ resource: ticket.resource._id, status: { $in: ['ACTIVE', 'RETURN_REQUESTED'] } });
    await Resource.updateOne({ _id: ticket.resource._id }, { $set: { status: stillAllocated ? 'ALLOCATED' : 'AVAILABLE' } });
    await notify(ticket.reportedBy, 'MAINTENANCE', `${ticket.ticketNo} resolved: ${ticket.resource.name} is back in service`);
  }
  await ticket.save();
  await logActivity(admin, 'UPDATE_TICKET', 'Maintenance', ticket._id, `${ticket.ticketNo} -> ${ticket.status}`);
  return ticket.populate(populate);
};
