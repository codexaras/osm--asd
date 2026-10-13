import User, { ROLES } from '../models/User.js';
import Allocation from '../models/Allocation.js';
import { badRequest, conflict, notFound, pick, requireFields } from '../utils/http.js';
import { logActivity } from './audit.service.js';

export const listUsers = async (query = {}) => {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.search) {
    const rx = new RegExp(String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { department: rx }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 }).lean();
  const counts = await Allocation.aggregate([
    { $match: { status: { $in: ['ACTIVE', 'RETURN_REQUESTED'] } } },
    { $group: { _id: '$employee', n: { $sum: 1 } } }
  ]);
  const byUser = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  return users.map(({ password, __v, ...u }) => ({ ...u, activeAllocations: byUser[String(u._id)] || 0 }));
};

export const createUser = async (admin, body) => {
  requireFields(body, ['name', 'email', 'password']);
  if (body.role && !ROLES.includes(body.role)) throw badRequest('Invalid role');
  if (await User.exists({ email: String(body.email).toLowerCase() })) throw conflict('Email already in use');
  const user = await User.create(pick(body, ['name', 'email', 'password', 'role', 'department', 'phone']));
  await logActivity(admin, 'CREATE_USER', 'User', user._id, `Admin created ${user.role} account for ${user.email}`);
  return user;
};

export const updateUser = async (admin, id, body) => {
  const user = await User.findById(id);
  if (!user) throw notFound('User');
  if (body.role && !ROLES.includes(body.role)) throw badRequest('Invalid role');
  if (String(user._id) === String(admin._id) && body.role && body.role !== 'ADMIN') {
    throw badRequest('You cannot remove your own admin role');
  }
  Object.assign(user, pick(body, ['name', 'department', 'phone', 'role']));
  await user.save();
  await logActivity(admin, 'UPDATE_USER', 'User', user._id, `Admin updated ${user.email}`);
  return user;
};

export const setUserStatus = async (admin, id, isActive) => {
  const user = await User.findById(id);
  if (!user) throw notFound('User');
  if (String(user._id) === String(admin._id)) throw badRequest('You cannot deactivate your own account');
  user.isActive = Boolean(isActive);
  await user.save();
  await logActivity(admin, user.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'User', user._id, `${user.email} ${user.isActive ? 'activated' : 'deactivated'}`);
  return user;
};
