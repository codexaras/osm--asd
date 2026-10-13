import Resource from '../models/Resource.js';
import ResourceRequest from '../models/ResourceRequest.js';
import Allocation from '../models/Allocation.js';
import Booking from '../models/Booking.js';
import Maintenance from '../models/Maintenance.js';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import Notification from '../models/Notification.js';

const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));

const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// Bucket bookings per calendar day (server local time), including days with zero bookings.
const perDay = (bookings, from, days) => {
  const counts = {};
  bookings.forEach((b) => {
    const k = dayKey(b.startAt);
    counts[k] = (counts[k] || 0) + 1;
  });
  return Array.from({ length: days + 1 }, (_, i) => {
    const k = dayKey(new Date(from.getTime() + i * 864e5));
    return { date: k, count: counts[k] || 0 };
  });
};

export const adminDashboard = async () => {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 864e5);

  const [byStatus, byCategory, requestStatus, activeAllocations, returnRequests, upcoming, openTickets, employees, recent, bookingsPerDay] =
    await Promise.all([
      Resource.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Resource.aggregate([{ $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
      ResourceRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Allocation.countDocuments({ status: 'ACTIVE' }),
      Allocation.countDocuments({ status: 'RETURN_REQUESTED' }),
      Booking.find({ status: 'CONFIRMED', endAt: { $gte: now } })
        .populate('resource', 'name location')
        .populate('bookedBy', 'name')
        .sort({ startAt: 1 })
        .limit(6),
      Maintenance.find({ status: { $ne: 'RESOLVED' } }).populate('resource', 'name assetTag').sort({ createdAt: -1 }).limit(6),
      User.countDocuments({ role: 'EMPLOYEE', isActive: true }),
      ActivityLog.find().populate('actor', 'name role').sort({ createdAt: -1 }).limit(8),
      Booking.find({ status: 'CONFIRMED', startAt: { $gte: weekAgo, $lte: new Date(now.getTime() + 7 * 864e5) } })
        .select('startAt')
        .lean()
    ]);

  const status = toMap(byStatus);
  const total = byStatus.reduce((a, r) => a + r.n, 0);
  return {
    stats: {
      totalResources: total,
      available: status.AVAILABLE || 0,
      allocated: status.ALLOCATED || 0,
      underMaintenance: status.UNDER_MAINTENANCE || 0,
      retired: status.RETIRED || 0,
      pendingRequests: toMap(requestStatus).PENDING || 0,
      activeAllocations,
      returnRequests,
      openTickets: openTickets.length,
      employees
    },
    resourcesByCategory: byCategory.map((r) => ({ category: r._id, count: r.n })),
    resourcesByStatus: byStatus.map((r) => ({ status: r._id, count: r.n })),
    bookingsPerDay: perDay(bookingsPerDay, weekAgo, 14),
    upcomingBookings: upcoming,
    openTickets,
    recentActivity: recent
  };
};

export const employeeDashboard = async (user) => {
  const now = new Date();
  const [allocations, requests, bookings, tickets, unread] = await Promise.all([
    Allocation.find({ employee: user._id, status: { $ne: 'RETURNED' } }).populate('resource', 'assetTag name category location'),
    ResourceRequest.find({ employee: user._id }).populate('resource', 'assetTag name').sort({ createdAt: -1 }).limit(5),
    Booking.find({ bookedBy: user._id, status: 'CONFIRMED', endAt: { $gte: now } })
      .populate('resource', 'name location')
      .sort({ startAt: 1 })
      .limit(5),
    Maintenance.find({ reportedBy: user._id, status: { $ne: 'RESOLVED' } }).populate('resource', 'name assetTag'),
    Notification.countDocuments({ user: user._id, isRead: false })
  ]);
  return {
    stats: {
      myAssets: allocations.length,
      pendingRequests: requests.filter((r) => r.status === 'PENDING').length,
      upcomingBookings: bookings.length,
      openTickets: tickets.length,
      unreadNotifications: unread
    },
    allocations,
    recentRequests: requests,
    upcomingBookings: bookings,
    openTickets: tickets
  };
};

export const listActivity = async (query = {}) => {
  const limit = Math.min(Number(query.limit) || 50, 200);
  const page = Math.max(Number(query.page) || 1, 1);
  const filter = query.entity ? { entity: query.entity } : {};
  const [items, total] = await Promise.all([
    ActivityLog.find(filter)
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ActivityLog.countDocuments(filter)
  ]);
  return { items, total, page, pages: Math.ceil(total / limit) };
};

export const listNotifications = async (user) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: user._id, isRead: false })
  ]);
  return { items, unread };
};

export const markNotificationsRead = async (user, id) => {
  const filter = { user: user._id, isRead: false };
  if (id) filter._id = id;
  const res = await Notification.updateMany(filter, { $set: { isRead: true } });
  return { updated: res.modifiedCount };
};
