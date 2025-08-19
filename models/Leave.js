import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
  employee: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: true 
  },
  company: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Company', 
    required: true 
  },
  leaveType: { 
    type: String, 
    required: true 
  },
  shortCode: { 
    type: String, 
    required: true 
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  days: { 
    type: Number, 
    required: true 
  },
  reason: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'cancelled'], 
    default: 'pending' 
  },
  approvedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  rejectedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  approvedAt: Date,
  rejectionReason: String,
  documents: [{ 
    name: String, 
    url: String 
  }],
  isHalfDay: {
    type: Boolean,
    default: false
  },
  halfDayType: {
    type: String,
    enum: ['first-half', 'second-half', null],
    default: null
  }
}, { 
  timestamps: true 
});

// Indexes for performance
leaveSchema.index({ employee: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ company: 1, status: 1 });
leaveSchema.index({ company: 1, employee: 1, leaveType: 1 });

export default mongoose.model('Leave', leaveSchema);