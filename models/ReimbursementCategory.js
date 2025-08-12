// models/ReimbursementCategory.js
import mongoose from 'mongoose';

const reimbursementCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('ReimbursementCategory', reimbursementCategorySchema);
