import ActivityLog from '../models/ActivityLog.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import logger from '../utils/logger.js';

// Audit trail entry. Failures are logged, never thrown, so they can't break a business action.
export const logActivity = async (actor, action, entity, entityId, description) => {
  try {
    await ActivityLog.create({ actor: actor?._id || actor, action, entity, entityId: String(entityId || ''), description });
  } catch (err) {
    logger.warn('Failed to write activity log', { action, error: err.message });
  }
};

export const notify = async (userId, type, message) => {
  try {
    await Notification.create({ user: userId, type, message });
  } catch (err) {
    logger.warn('Failed to create notification', { type, error: err.message });
  }
};

export const notifyAdmins = async (type, message) => {
  const admins = await User.find({ role: 'ADMIN', isActive: true }).select('_id');
  await Promise.all(admins.map((a) => notify(a._id, type, message)));
};
