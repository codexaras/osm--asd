import Booking from '../models/Booking.js';
import Resource from '../models/Resource.js';
import { badRequest, conflict, forbidden, notFound, requireFields } from '../utils/http.js';
import { events } from '../metrics/metrics.js';
import { isAdmin } from '../middleware/auth.js';
import { logActivity, notify } from './audit.service.js';

const MAX_HOURS = 10;
const populate = [
  { path: 'resource', select: 'assetTag name category location capacity' },
  { path: 'bookedBy', select: 'name email department' }
];

/**
 * Two half-open intervals [s1, e1) and [s2, e2) overlap iff  s1 < e2 AND s2 < e1.
 * Back-to-back slots (10:00-11:00 and 11:00-12:00) therefore do NOT conflict.
 */
export const overlaps = (s1, e1, s2, e2) => s1 < e2 && s2 < e1;

export const findConflict = (resourceId, startAt, endAt, excludeId) =>
  Booking.findOne({
    resource: resourceId,
    status: 'CONFIRMED',
    startAt: { $lt: endAt },
    endAt: { $gt: startAt },
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  }).populate('bookedBy', 'name');

export const listBookings = async (user, query = {}) => {
  const filter = {};
  if (!isAdmin(user) && query.scope !== 'all') filter.bookedBy = user._id;
  if (query.resourceId) filter.resource = query.resourceId;
  if (query.status) filter.status = query.status;
  if (query.upcoming === 'true') filter.endAt = { $gte: new Date() };
  if (query.from || query.to) {
    filter.startAt = {};
    if (query.from) filter.startAt.$gte = new Date(query.from);
    if (query.to) filter.startAt.$lt = new Date(query.to);
  }
  const bookings = await Booking.find(filter).populate(populate).sort({ startAt: 1 });
  // Employees browsing the shared calendar only see who booked, not contact details.
  if (!isAdmin(user) && query.scope === 'all') {
    return bookings.map((b) => {
      const o = b.toObject();
      if (String(o.bookedBy?._id) !== String(user._id)) o.bookedBy = { name: o.bookedBy?.name };
      return o;
    });
  }
  return bookings;
};

export const createBooking = async (user, body) => {
  requireFields(body, ['resourceId', 'purpose', 'startAt', 'endAt']);
  const startAt = new Date(body.startAt);
  const endAt = new Date(body.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) throw badRequest('Invalid start or end time');
  if (endAt <= startAt) throw badRequest('End time must be after start time');
  if (startAt < new Date(Date.now() - 5 * 60 * 1000)) throw badRequest('Cannot book a slot in the past');
  if ((endAt - startAt) / 36e5 > MAX_HOURS) throw badRequest(`A booking cannot exceed ${MAX_HOURS} hours`);

  const resource = await Resource.findById(body.resourceId);
  if (!resource) throw notFound('Resource');
  if (!resource.isShared) throw badRequest(`${resource.name} is not a shared/bookable resource`);
  if (resource.status !== 'AVAILABLE') throw conflict(`${resource.name} is currently ${resource.status.replace('_', ' ').toLowerCase()}`);
  if (body.attendees && resource.capacity && Number(body.attendees) > resource.capacity) {
    throw badRequest(`${resource.name} holds at most ${resource.capacity} people`);
  }

  const clash = await findConflict(resource._id, startAt, endAt);
  if (clash) {
    events.bookings.inc({ outcome: 'conflict' });
    const fmt = (d) => d.toISOString().slice(11, 16);
    throw conflict(`${resource.name} is already booked ${fmt(clash.startAt)}-${fmt(clash.endAt)} UTC by ${clash.bookedBy?.name || 'another user'}`);
  }

  const booking = await Booking.create({
    resource: resource._id,
    bookedBy: user._id,
    purpose: body.purpose,
    startAt,
    endAt,
    attendees: body.attendees || 1
  });
  events.bookings.inc({ outcome: 'confirmed' });
  await notify(user._id, 'BOOKING', `Booking confirmed: ${resource.name} - ${body.purpose}`);
  await logActivity(user, 'CREATE_BOOKING', 'Booking', booking._id, `${user.name} booked ${resource.name}`);
  return booking.populate(populate);
};

export const cancelBooking = async (user, id) => {
  const booking = await Booking.findById(id).populate('resource');
  if (!booking) throw notFound('Booking');
  if (!isAdmin(user) && String(booking.bookedBy) !== String(user._id)) throw forbidden('You can only cancel your own bookings');
  if (booking.status === 'CANCELLED') throw conflict('Booking already cancelled');
  booking.status = 'CANCELLED';
  await booking.save();
  events.bookings.inc({ outcome: 'cancelled' });
  if (String(booking.bookedBy) !== String(user._id)) {
    await notify(booking.bookedBy, 'BOOKING', `Your booking of ${booking.resource.name} was cancelled by an admin`);
  }
  await logActivity(user, 'CANCEL_BOOKING', 'Booking', booking._id, `Cancelled booking of ${booking.resource.name}`);
  return booking.populate(populate);
};
