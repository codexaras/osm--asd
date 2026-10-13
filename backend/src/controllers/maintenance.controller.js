import * as maintenance from '../services/maintenance.service.js';
import { asyncHandler, ok, created } from '../utils/http.js';

export const list = asyncHandler(async (req, res) => ok(res, await maintenance.listTickets(req.user, req.query)));
export const create = asyncHandler(async (req, res) => created(res, await maintenance.reportIssue(req.user, req.body), 'Issue reported'));
export const update = asyncHandler(async (req, res) => ok(res, await maintenance.updateTicket(req.user, req.params.id, req.body), 'Ticket updated'));
