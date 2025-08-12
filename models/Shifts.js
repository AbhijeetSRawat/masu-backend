import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true },
  startTime: { type: String, required: true }, // Example: '09:00'
  endTime: { type: String, required: true },   // Example: '18:00'
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

shiftSchema.index({ company: 1, name: 1 }, { unique: true });

export default mongoose.model('Shift', shiftSchema);
