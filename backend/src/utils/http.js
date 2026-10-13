// Small HTTP helpers shared by all controllers.

export class AppError extends Error {
  constructor(message, statusCode = 400, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new AppError(msg, 400, details);
export const unauthorized = (msg = 'Not authenticated') => new AppError(msg, 401);
export const forbidden = (msg = 'You do not have permission to perform this action') => new AppError(msg, 403);
export const notFound = (what = 'Resource') => new AppError(`${what} not found`, 404);
export const conflict = (msg) => new AppError(msg, 409);

// Wrap async route handlers so rejected promises reach the error middleware.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const ok = (res, data, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, data });

export const created = (res, data, message = 'Created') => ok(res, data, message, 201);

// Pick only allowed keys from a request body (prevents mass-assignment, e.g. role escalation).
export const pick = (obj = {}, keys = []) =>
  keys.reduce((acc, k) => {
    if (obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});

export const requireFields = (body, fields) => {
  const missing = fields.filter((f) => body?.[f] === undefined || body?.[f] === null || body?.[f] === '');
  if (missing.length) throw badRequest(`Missing required field(s): ${missing.join(', ')}`);
};
