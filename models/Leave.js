import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
  employee: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  company: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['casual', 'sick', 'earned', 'maternity', 'paternity', 'unpaid'],
    required: true
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  days: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rejectionReason: String,
  documents: [{
    name: String,
    url: String
  }]
}, { timestamps: true });

leaveSchema.index({ employee: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ company: 1, status: 1 });

export default mongoose.model('Leave', leaveSchema);