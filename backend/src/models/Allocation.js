import mongoose from 'mongoose';

export const ALLOCATION_STATUS = ['ACTIVE', 'RETURN_REQUESTED', 'RETURNED'];

const allocationSchema = new mongoose.Schema(
  {
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'ResourceRequest' },
    allocatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    status: { type: String, enum: ALLOCATION_STATUS, default: 'ACTIVE' },
    returnedAt: { type: Date },
    returnCondition: { type: String, enum: ['GOOD', 'DAMAGED', ''], default: '' },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

allocationSchema.index({ resource: 1, status: 1 });
allocationSchema.index({ employee: 1, status: 1 });

export default mongoose.model('Allocation', allocationSchema);
