import * as dash from '../services/dashboard.service.js';
import { isAdmin } from '../middleware/auth.js';
import { asyncHandler, ok } from '../utils/http.js';

export const summary = asyncHandler(async (req, res) =>
  ok(res, isAdmin(req.user) ? await dash.adminDashboard() : await dash.employeeDashboard(req.user))
);
export const activity = asyncHandler(async (req, res) => ok(res, await dash.listActivity(req.query)));
export const notifications = asyncHandler(async (req, res) => ok(res, await dash.listNotifications(req.user)));
export const markRead = asyncHandler(async (req, res) => ok(res, await dash.markNotificationsRead(req.user, req.params.id)));
