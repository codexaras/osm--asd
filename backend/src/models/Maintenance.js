import mongoose from 'mongoose';

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const TICKET_STATUS = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

const maintenanceSchema = new mongoose.Schema(
  {
    ticketNo: { type: String, unique: true },
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    issue: { type: String, required: true, trim: true, maxlength: 1000 },
    priority: { type: String, enum: PRIORITIES, default: 'MEDIUM' },
    status: { type: String, enum: TICKET_STATUS, default: 'OPEN' },
    // The status the resource had before it went into maintenance, restored on resolve.
    previousResourceStatus: { type: String, default: 'AVAILABLE' },
    resolutionNote: { type: String, default: '' },
    resolvedAt: { type: Date }
  },
  { timestamps: true }
);

maintenanceSchema.pre('save', async function assignTicketNo(next) {
  if (this.ticketNo) return next();
  const count = await this.constructor.countDocuments();
  this.ticketNo = `MT-${String(count + 1).padStart(4, '0')}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
  return next();
});

export default mongoose.model('Maintenance', maintenanceSchema);
