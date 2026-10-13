import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';
import { asyncHandler, unauthorized, forbidden } from '../utils/http.js';

// Verifies the Bearer token and attaches the user document to req.user.
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized('Authentication token missing');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthorized('Invalid or expired token');
  }

  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw unauthorized('Account not found or deactivated');
  req.user = user;
  next();
});

// Role guard: authorize('ADMIN') or authorize('ADMIN', 'EMPLOYEE').
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(forbidden());
    return next();
  };

export const isAdmin = (user) => user?.role === 'ADMIN';
