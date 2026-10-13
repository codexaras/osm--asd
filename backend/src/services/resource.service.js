import Resource, { CATEGORIES, RESOURCE_STATUS } from '../models/Resource.js';
import Allocation from '../models/Allocation.js';
import Booking from '../models/Booking.js';
import { badRequest, conflict, notFound, pick, requireFields } from '../utils/http.js';
import { logActivity } from './audit.service.js';

const FIELDS = ['assetTag', 'name', 'category', 'description', 'location', 'isShared', 'capacity'];

export const listResources = async (query = {}) => {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.shared !== undefined) filter.isShared = query.shared === 'true';
  if (query.search) {
    const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { assetTag: rx }, { location: rx }];
  }
  return Resource.find(filter).sort({ category: 1, name: 1 });
};

export const getResource = async (id) => {
  const resource = await Resource.findById(id);
  if (!resource) throw notFound('Resource');
  return resource;
};

export const createResource = async (admin, body) => {
  requireFields(body, ['assetTag', 'name', 'category', 'location']);
  if (!CATEGORIES.includes(body.category)) throw badRequest(`Category must be one of: ${CATEGORIES.join(', ')}`);
  const resource = await Resource.create({ ...pick(body, FIELDS), createdBy: admin._id });
  await logActivity(admin, 'CREATE_RESOURCE', 'Resource', resource._id, `Added ${resource.assetTag} - ${resource.name}`);
  return resource;
};

export const updateResource = async (admin, id, body) => {
  const resource = await getResource(id);
  Object.assign(resource, pick(body, FIELDS));
  await resource.save();
  await logActivity(admin, 'UPDATE_RESOURCE', 'Resource', resource._id, `Updated ${resource.assetTag}`);
  return resource;
};

// Manual status override (e.g. retire an asset). ALLOCATED is controlled by the allocation workflow.
export const setResourceStatus = async (admin, id, status) => {
  if (!RESOURCE_STATUS.includes(status)) throw badRequest('Invalid status');
  if (status === 'ALLOCATED') throw badRequest('Use the allocation workflow to allocate a resource');
  const resource = await getResource(id);
  const active = await Allocation.exists({ resource: resource._id, status: { $in: ['ACTIVE', 'RETURN_REQUESTED'] } });
  if (active && status !== 'UNDER_MAINTENANCE') throw conflict('Resource has an active allocation - confirm its return first');
  resource.status = status;
  await resource.save();
  await logActivity(admin, 'SET_RESOURCE_STATUS', 'Resource', resource._id, `${resource.assetTag} -> ${status}`);
  return resource;
};

export const deleteResource = async (admin, id) => {
  const resource = await getResource(id);
  const active = await Allocation.exists({ resource: resource._id, status: { $in: ['ACTIVE', 'RETURN_REQUESTED'] } });
  if (active) throw conflict('Cannot delete a resource that is currently allocated');
  const futureBooking = await Booking.exists({ resource: resource._id, status: 'CONFIRMED', endAt: { $gt: new Date() } });
  if (futureBooking) throw conflict('Cannot delete a resource with upcoming bookings');
  await resource.deleteOne();
  await logActivity(admin, 'DELETE_RESOURCE', 'Resource', id, `Deleted ${resource.assetTag} - ${resource.name}`);
  return { id };
};

export const meta = () => ({ categories: CATEGORIES, statuses: RESOURCE_STATUS });
