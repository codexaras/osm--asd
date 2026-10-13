import mongoose from 'mongoose';

export const CATEGORIES = ['Laptop', 'Monitor', 'Projector', 'Meeting Room', 'Printer', 'Phone', 'Furniture', 'Other'];
export const RESOURCE_STATUS = ['AVAILABLE', 'ALLOCATED', 'UNDER_MAINTENANCE', 'RETIRED'];

const resourceSchema = new mongoose.Schema(
  {
    assetTag: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, default: 'Other' },
    description: { type: String, default: '', trim: true },
    location: { type: String, required: true, trim: true },
    // Shared resources (rooms, projectors) are booked by time slot instead of allocated.
    isShared: { type: Boolean, default: false },
    capacity: { type: Number, default: 0 },
    status: { type: String, enum: RESOURCE_STATUS, default: 'AVAILABLE' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

resourceSchema.index({ status: 1, category: 1 });

export default mongoose.model('Resource', resourceSchema);
