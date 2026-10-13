import * as allocations from '../services/allocation.service.js';
import { asyncHandler, ok, created } from '../utils/http.js';

export const list = asyncHandler(async (req, res) => ok(res, await allocations.listAllocations(req.user, req.query)));
export const create = asyncHandler(async (req, res) => created(res, await allocations.directAllocate(req.user, req.body), 'Resource allocated'));
export const requestReturn = asyncHandler(async (req, res) =>
  ok(res, await allocations.requestReturn(req.user, req.params.id, req.body), 'Return requested')
);
export const confirmReturn = asyncHandler(async (req, res) =>
  ok(res, await allocations.confirmReturn(req.user, req.params.id, req.body), 'Return confirmed')
);
