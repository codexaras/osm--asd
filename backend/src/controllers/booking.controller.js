import * as bookings from '../services/booking.service.js';
import { asyncHandler, ok, created } from '../utils/http.js';

export const list = asyncHandler(async (req, res) => ok(res, await bookings.listBookings(req.user, req.query)));
export const create = asyncHandler(async (req, res) => created(res, await bookings.createBooking(req.user, req.body), 'Booking confirmed'));
export const cancel = asyncHandler(async (req, res) => ok(res, await bookings.cancelBooking(req.user, req.params.id), 'Booking cancelled'));
