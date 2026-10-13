import * as requests from '../services/request.service.js';
import { asyncHandler, ok, created } from '../utils/http.js';

export const list = asyncHandler(async (req, res) => ok(res, await requests.listRequests(req.user, req.query)));
export const create = asyncHandler(async (req, res) => created(res, await requests.createRequest(req.user, req.body), 'Request submitted'));
export const approve = asyncHandler(async (req, res) => ok(res, await requests.approveRequest(req.user, req.params.id, req.body), 'Request approved'));
export const reject = asyncHandler(async (req, res) => ok(res, await requests.rejectRequest(req.user, req.params.id, req.body), 'Request rejected'));
export const cancel = asyncHandler(async (req, res) => ok(res, await requests.cancelRequest(req.user, req.params.id), 'Request cancelled'));
