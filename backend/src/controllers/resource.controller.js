import * as resources from '../services/resource.service.js';
import { asyncHandler, ok, created } from '../utils/http.js';

export const list = asyncHandler(async (req, res) => ok(res, await resources.listResources(req.query)));
export const meta = (_req, res) => ok(res, resources.meta());
export const get = asyncHandler(async (req, res) => ok(res, await resources.getResource(req.params.id)));
export const create = asyncHandler(async (req, res) => created(res, await resources.createResource(req.user, req.body), 'Resource created'));
export const update = asyncHandler(async (req, res) => ok(res, await resources.updateResource(req.user, req.params.id, req.body), 'Resource updated'));
export const setStatus = asyncHandler(async (req, res) =>
  ok(res, await resources.setResourceStatus(req.user, req.params.id, req.body.status), 'Status updated')
);
export const remove = asyncHandler(async (req, res) => ok(res, await resources.deleteResource(req.user, req.params.id), 'Resource deleted'));
