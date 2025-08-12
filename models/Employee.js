import mongoose from 'mongoose';


const customFieldSchema = new mongoose.Schema({
  label: { type: String },
  name: { type: String },
  type: { type: String, enum: ['text', 'number', 'date', 'boolean'] },
  required: { type: Boolean, default: false },
  defaultValue: mongoose.Schema.Types.Mixed
}, { _id: false });



const employmentSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  joiningDate: { type: Date, required: true },
  resignationDate: { type: Date },
  lastWorkingDate: { type: Date },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },  // You already have department in profile, but can keep for employment history
  designation: { type: String },
  employmentType: { 
    type: String, 
    enum: ['full-time', 'part-time', 'contract', 'intern'],
    default: 'full-time'
  },
  status: {
  type: String,
  enum: ['active', 'inactive', 'terminated'],
  default: 'active'
},
  workLocation: String,
  costCenter: String,
  businessArea: String,
  pfFlag: { type: Boolean, default: false },
  esicFlag: { type: Boolean, default: false },
  ptFlag: { type: Boolean, default: false },
  salary: {
    base: { type: Number,  },
    bonus: Number,
    taxDeductions: Number
  },
  shift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
  reportingTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  skills: [String],
  documents: [{
  name: { type: String },
  type: { type: String },
  url: { type: String },
  uploadedAt: { type: Date }
}]
}, { _id: false });

const personalDetailsSchema = new mongoose.Schema({
  gender: { type: String, enum: ['male', 'female', 'other'] },
  dateOfBirth: { type: Date },
  city: String,
  state: String,
  panNo: String,
  aadharNo: String,
  uanNo: String,
  esicNo: String,
  bankAccountNo: String,
  ifscCode: String,
  personalEmail: String,
  officialMobile: String,
  personalMobile: String
}, { _id: false });

const employeeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  personalDetails: personalDetailsSchema,
  employmentDetails: { type: employmentSchema, required: true },
  leaveBalance: {
    casual: { type: Number, default: 0 },
    sick: { type: Number, default: 0 },
    earned: { type: Number, default: 0 }
  },
  attendance: [{
    date: Date,
    status: { type: String, enum: ['present', 'absent', 'half-day', 'holiday'] },
    checkIn: Date,
    checkOut: Date,
    notes: String
  }],
    customFields: [customFieldSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

employeeSchema.index({ company: 1, 'employmentDetails.employeeId': 1 }, { unique: true });

export default mongoose.model('Employee', employeeSchema);
