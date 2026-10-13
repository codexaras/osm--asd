import * as auth from '../services/auth.service.js';
import { asyncHandler, ok, created } from '../utils/http.js';

export const signup = asyncHandler(async (req, res) => created(res, await auth.signup(req.body), 'Account created'));
export const login = asyncHandler(async (req, res) => ok(res, await auth.login(req.body), 'Logged in'));
export const me = asyncHandler(async (req, res) => ok(res, { user: req.user }));
export const updateProfile = asyncHandler(async (req, res) => ok(res, { user: await auth.updateProfile(req.user, req.body) }, 'Profile updated'));
