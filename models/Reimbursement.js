// models/Reimbursement.js
import mongoose from 'mongoose';

const reimbursementSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'ReimbursementCategory', required: true },
  amount: { type: Number, required: true },
  description: { type: String },
  receiptUrl: { type: String }, // optional: file upload URL
  date: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'rejected'],
    default: 'pending'
  },
    paymentSlip: {
    transactionId: String,
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: Date,
     paidslipUrl: String,
    note: String
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date
}, { timestamps: true });

export default mongoose.model('Reimbursement', reimbursementSchema);
