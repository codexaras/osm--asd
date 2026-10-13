import mongoose from 'mongoose';

export const REQUEST_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

const requestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    neededUntil: { type: Date },
    status: { type: String, enum: REQUEST_STATUS, default: 'PENDING' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, default: '' }
  },
  { timestamps: true }
);

requestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('ResourceRequest', requestSchema);
