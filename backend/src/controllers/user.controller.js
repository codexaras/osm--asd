import * as users from '../services/user.service.js';
import { asyncHandler, ok, created } from '../utils/http.js';

export const list = asyncHandler(async (req, res) => ok(res, await users.listUsers(req.query)));
export const create = asyncHandler(async (req, res) => created(res, await users.createUser(req.user, req.body), 'User created'));
export const update = asyncHandler(async (req, res) => ok(res, await users.updateUser(req.user, req.params.id, req.body), 'User updated'));
export const setStatus = asyncHandler(async (req, res) =>
  ok(res, await users.setUserStatus(req.user, req.params.id, req.body.isActive), 'Status updated')
);
