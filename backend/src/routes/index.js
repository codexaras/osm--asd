/**
 * API route map. Every route below /api except auth/signup, auth/login,
 * /health and /metrics requires a valid JWT (protect). Admin-only routes
 * are additionally guarded with authorize('ADMIN').
 */
import { Router } from 'express';
import { protect, authorize } from '../middleware/auth.js';
import * as auth from '../controllers/auth.controller.js';
import * as users from '../controllers/user.controller.js';
import * as resources from '../controllers/resource.controller.js';
import * as requests from '../controllers/request.controller.js';
import * as allocations from '../controllers/allocation.controller.js';
import * as bookings from '../controllers/booking.controller.js';
import * as maintenance from '../controllers/maintenance.controller.js';
import * as dashboard from '../controllers/dashboard.controller.js';

const admin = authorize('ADMIN');
const router = Router();

// ---- Auth ------------------------------------------------------------------
router.post('/auth/signup', auth.signup);
router.post('/auth/login', auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/me', protect, auth.updateProfile);

// ---- Users (admin) ---------------------------------------------------------
router.get('/users', protect, admin, users.list);
router.post('/users', protect, admin, users.create);
router.put('/users/:id', protect, admin, users.update);
router.patch('/users/:id/status', protect, admin, users.setStatus);

// ---- Resources -------------------------------------------------------------
router.get('/resources', protect, resources.list);
router.get('/resources/meta', protect, resources.meta);
router.get('/resources/:id', protect, resources.get);
router.post('/resources', protect, admin, resources.create);
router.put('/resources/:id', protect, admin, resources.update);
router.patch('/resources/:id/status', protect, admin, resources.setStatus);
router.delete('/resources/:id', protect, admin, resources.remove);

// ---- Resource requests -----------------------------------------------------
router.get('/requests', protect, requests.list);
router.post('/requests', protect, authorize('EMPLOYEE'), requests.create);
router.patch('/requests/:id/approve', protect, admin, requests.approve);
router.patch('/requests/:id/reject', protect, admin, requests.reject);
router.patch('/requests/:id/cancel', protect, requests.cancel);

// ---- Allocations -----------------------------------------------------------
router.get('/allocations', protect, allocations.list);
router.post('/allocations', protect, admin, allocations.create);
router.patch('/allocations/:id/return-request', protect, allocations.requestReturn);
router.patch('/allocations/:id/confirm-return', protect, admin, allocations.confirmReturn);

// ---- Bookings (shared rooms / projectors) ---------------------------------
router.get('/bookings', protect, bookings.list);
router.post('/bookings', protect, bookings.create);
router.patch('/bookings/:id/cancel', protect, bookings.cancel);

// ---- Maintenance -----------------------------------------------------------
router.get('/maintenance', protect, maintenance.list);
router.post('/maintenance', protect, maintenance.create);
router.patch('/maintenance/:id', protect, admin, maintenance.update);

// ---- Dashboard, notifications, audit log ----------------------------------
router.get('/dashboard', protect, dashboard.summary);
router.get('/notifications', protect, dashboard.notifications);
router.patch('/notifications/read-all', protect, dashboard.markRead);
router.patch('/notifications/:id/read', protect, dashboard.markRead);
router.get('/activity', protect, admin, dashboard.activity);

export default router;
