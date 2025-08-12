// models/Department.js
import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  description: String,
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // optional
}, { timestamps: true });

export default mongoose.model('Department', departmentSchema);
