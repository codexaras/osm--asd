import User from '../models/User.js';
import { signToken } from '../utils/jwt.js';
import { badRequest, unauthorized, conflict, pick, requireFields } from '../utils/http.js';
import { events } from '../metrics/metrics.js';
import { logActivity } from './audit.service.js';

export const signup = async (body) => {
  requireFields(body, ['name', 'email', 'password']);
  if (String(body.password).length < 6) throw badRequest('Password must be at least 6 characters');

  const exists = await User.findOne({ email: String(body.email).toLowerCase() });
  if (exists) throw conflict('An account with this email already exists');

  // Role is NEVER taken from the request: public sign-up always creates an EMPLOYEE.
  const user = await User.create({ ...pick(body, ['name', 'email', 'password', 'department', 'phone']), role: 'EMPLOYEE' });
  events.signups.inc();
  await logActivity(user, 'SIGNUP', 'User', user._id, `${user.name} registered as employee`);
  return { user, token: signToken(user) };
};

export const login = async ({ email, password } = {}) => {
  if (!email || !password) throw badRequest('Email and password are required');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.checkPassword(password))) {
    events.logins.inc({ result: 'failure' });
    throw unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    events.logins.inc({ result: 'failure' });
    throw unauthorized('This account has been deactivated');
  }

  user.lastLoginAt = new Date();
  await user.save();
  events.logins.inc({ result: 'success' });
  await logActivity(user, 'LOGIN', 'User', user._id, `${user.name} logged in`);
  return { user, token: signToken(user) };
};

export const updateProfile = async (user, body) => {
  Object.assign(user, pick(body, ['name', 'department', 'phone']));
  if (body.newPassword) {
    if (String(body.newPassword).length < 6) throw badRequest('Password must be at least 6 characters');
    const withPwd = await User.findById(user._id).select('+password');
    if (!(await withPwd.checkPassword(body.currentPassword || ''))) throw badRequest('Current password is incorrect');
    withPwd.password = body.newPassword;
    Object.assign(withPwd, pick(body, ['name', 'department', 'phone']));
    await withPwd.save();
    return withPwd;
  }
  await user.save();
  return user;
};
