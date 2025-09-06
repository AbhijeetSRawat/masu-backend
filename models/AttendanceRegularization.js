import mongoose from "mongoose";

// Define the schema for attendance regularization requests
const attendanceRegularizationSchema = new mongoose.Schema({

  // Reference to the employee making the request
  employee: { 
    type: mongoose.Schema.Types.ObjectId,  // MongoDB ObjectId
    ref: 'Employee',                      // Refers to Employee collection
    required: true                        // Mandatory field
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Reference to the company the employee belongs to
  company: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },

  // The date for which the regularization is being requested
  from: { 
    type: Date,
    required: true
  },

  to:{
    type: Date,
    required: true
  },
  // The shift that was assigned to the employee on that date
  shift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
    required: true
  },

  // In-time that the employee is requesting (what they claim as correct)
  requestedInTime: {
    type: String,
    required: true
  },

  // Out-time that the employee is requesting
  requestedOutTime: {
    type: String,
    required: true
  },

  // The actual in-time recorded in the system (may be wrong or missing)
  // actualInTime: {
  //   type: String,
  //   required: true
  // },

  // // The actual out-time recorded in the system
  // actualOutTime: {
  //   type: String,
  //   required: true
  // },

  // The reason provided by the employee for the regularization request
  reason: {
    type: String,
    required: true,
    trim: true  // Removes whitespace from both ends
  },

  // Optional documents submitted as proof (e.g., screenshots, approvals)
  supportingDocuments: [{
    filename: String,         // Stored filename (on server or cloud)
    originalName: String,     // Original uploaded file name
    mimeType: String,         // File type (e.g., image/jpeg)
    size: Number,             // File size in bytes
    uploadDate: { type: Date, default: Date.now } // When file was uploaded
  }],

  // Current status of the request
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],  // Allowed values
    default: 'pending'
  },

  // The reviewer (e.g., manager or HR) who handled the request
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'  // Refers to the Employee who reviewed it
  },

  // Date when the request was reviewed
  reviewDate: {
    type: Date
  },

  // Optional comments by the reviewer
  reviewComments: {
    type: String,
    trim: true
  },

  // Type of regularization being requested
  regularizationType: {
    type: String,
    enum: [
      'work_from_home',    // Arrived late but wants it corrected
      'outdoor',        // Left early but had valid reason
      'missing_punch',          // Forgot to punch in/out
      'short_leave',            // Assigned incorrect shift
      'other'                   // Miscellaneous cases
    ],
    required: true
  },

  // Total hours worked (calculated or estimated)
  totalHours: {
    type: Number,
    default: 0
  },
  createdBy:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }

}, { timestamps: true }); // Adds createdAt and updatedAt timestamps automatically

// Indexes to improve query performance and ensure uniqueness if needed

// Allows quick lookup of requests by employee and date
attendanceRegularizationSchema.index({ employee: 1, date: 1 });

// Allows filtering requests by company and status (e.g., all pending requests for a company)
attendanceRegularizationSchema.index({ company: 1, status: 1 });

// Allows filtering by date and status (e.g., all rejected requests on a given day)
attendanceRegularizationSchema.index({ date: 1, status: 1 });

// Export the schema as a model to use in other parts of the app
export default mongoose.model('AttendanceRegularization', attendanceRegularizationSchema);
