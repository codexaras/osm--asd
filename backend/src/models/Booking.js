import mongoose from 'mongoose';

export const BOOKING_STATUS = ['CONFIRMED', 'CANCELLED'];

const bookingSchema = new mongoose.Schema(
  {
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, required: true, trim: true, maxlength: 200 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    attendees: { type: Number, default: 1, min: 1 },
    status: { type: String, enum: BOOKING_STATUS, default: 'CONFIRMED' }
  },
  { timestamps: true }
);

bookingSchema.index({ resource: 1, status: 1, startAt: 1, endAt: 1 });

export default mongoose.model('Booking', bookingSchema);
