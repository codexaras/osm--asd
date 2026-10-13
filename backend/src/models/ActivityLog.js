import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, default: '' },
    description: { type: String, required: true }
  },
  { timestamps: true }
);

activitySchema.index({ createdAt: -1 });

export default mongoose.model('ActivityLog', activitySchema);
