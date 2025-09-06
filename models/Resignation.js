import mongoose from 'mongoose';

const resignationSchema = new mongoose.Schema({
  // References the Employee document
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  
  // References the User document (for authentication)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // References the Company document
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  
  // Date when the employee submitted resignation
  resignationDate: {
    type: Date,
    required: true
  },
  
  // Proposed last working date by the employee
  proposedLastWorkingDate: {
    type: Date,
    required: true
  },
  
  // Actual last working date (may be adjusted by admin)
  actualLastWorkingDate: {
    type: Date
  },
  
  // Reason for resignation
  reason: {
    type: String,
    required: true
  },
  
  // Optional feedback from employee
  feedback: String,
  
  // Current status of the resignation process
   status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'withdrawn', 'completed'],
    default: 'pending'
  },
  rejectionReason: String, // Add this field
  
  // Who approved the resignation
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // When the resignation was approved
  approvalDate: Date,
  
  // Exit interview details
  exitInterview: {
    conducted: { type: Boolean, default: false },
    conductedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    conductedDate: Date,
    notes: String
  },
  
  // Handover information
  handoverNotes: String,
  
  // Track return of company assets
  assetsReturned: [{
    name: String,
    returned: { type: Boolean, default: false },
    returnedDate: Date,
    condition: String
  }],
  
  // Related documents (acceptance letter, etc.)
  documents: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }]
}, { 
  // Adds createdAt and updatedAt fields automatically
  timestamps: true 
});

export default mongoose.model('Resignation', resignationSchema);