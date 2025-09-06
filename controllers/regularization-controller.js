import Attendance from '../models/Attendance.js'
import Employee from '../models/Employee.js'
import Shift from '../models/Shifts.js'
import Company from '../models/Company.js'
import AttendanceRegularization from '../models/AttendanceRegularization.js';
import User from '../models/User.js';

// Get all regularization requests
export const getRegularizations = async (req, res) => {
  try {
    const { companyId, status, employeeId, startDate, endDate, page = 1, limit = 10 } = req.query;

    let filter = {};
    if (companyId) filter.company = companyId;
    if (status) filter.status = status;
    if (employeeId) filter.employee = employeeId;

    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count for pagination
    const total = await AttendanceRegularization.countDocuments(filter);

    // Get paginated results
    const regularizations = await AttendanceRegularization.find(filter)
      .populate('employee', 'employmentDetails personalDetails')
      .populate('user', 'email profile')
      .populate('createdBy', 'email profile')
      .populate('company', 'name registrationNumber email contactPhone')
      .populate('shift', 'name startTime endTime')
      .populate({
        path: 'reviewedBy',
        select: 'user',
        populate: {
          path: 'user',
          select: 'profile'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      count: regularizations.length,
      data: regularizations
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get a single regularization request
export const getRegularization = async (req, res) => {
  try {
    const regularization = await AttendanceRegularization.findById(req.params.id)
        .populate('employee', 'employmentDetails personalDetails')
      .populate('user', 'email profile')
      .populate('createdBy', 'email profile')
      .populate('company', 'name registrationNumber email contactPhone')
      .populate('shift', 'name startTime endTime')
      .populate({
        path: 'reviewedBy',
        select: 'user',
        populate:{
          path: 'user',
          select:'profile'
        }
      });
    
    if (!regularization) {
      return res.status(404).json({ message: 'Regularization request not found' });
    }
    
    res.json(regularization);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new regularization request
export const createRegularization = async (req, res) => {
  try {
    const {
      employee,
      user,
      company,
      from,
      to,
      shift,
      requestedInTime,
      requestedOutTime,
      reason,
      regularizationType
    } = req.body;
    
    // Check if employee exists
    const employeeExists = await Employee.findById(employee);
    if (!employeeExists) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    const userExists = await User.findById(user);
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if company exists
    const companyExists = await Company.findById(company);
    if (!companyExists) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    // Check if shift exists
    const shiftExists = await Shift.findById(shift);
    if (!shiftExists) {
      return res.status(404).json({ message: 'Shift not found' });
    }
    
    // Check if regularization already exists for this date and employee
    const existingRegularization = await AttendanceRegularization.findOne({
      employee,
      from: { $gte: new Date(from), $lte: new Date(to) }
    });
    
    if (existingRegularization) {
      return res.status(400).json({ message: 'Regularization request already exists for this date' });
    }
    
    // Calculate total hours
    const calculateHours = (inTime, outTime) => {
      const [inHours, inMinutes] = inTime.split(':').map(Number);
      const [outHours, outMinutes] = outTime.split(':').map(Number);
      
      let totalMinutes = (outHours * 60 + outMinutes) - (inHours * 60 + inMinutes);
      if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts
      
      return totalMinutes / 60;
    };
    
    const totalHours = calculateHours(requestedInTime, requestedOutTime);
    
    const regularization = new AttendanceRegularization({
      employee,
      user, // Assuming user authentication is implemented
      company,
      from: new Date(from),
      to: new Date(to),
      shift,
      requestedInTime,
      requestedOutTime,
      reason,
      regularizationType,
      totalHours,
      createdBy: req.user._id
    });
    
    const newRegularization = await regularization.save();
    
    // Populate the response
    const populatedRegularization = await AttendanceRegularization.findById(newRegularization._id)
       .populate('employee', 'employmentDetails.employeeId')
      .populate('user', 'email profile')
      .populate('company', 'name code')
      .populate('shift', 'name startTime endTime');
    
    res.status(201).json(populatedRegularization);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update a regularization request (approve/reject)
export const updateRegularization = async (req, res) => {
  try {
    const { status, reviewComments } = req.body;
    const { id } = req.params;
    const reviewedBy = req.user?.id; // Assuming user authentication is implemented
    
    const regularization = await AttendanceRegularization.findById(id);
    if (!regularization) {
      return res.status(404).json({ message: 'Regularization request not found' });
    }
    
    if (status && ['approved', 'rejected', 'cancelled'].includes(status)) {
      regularization.status = status;
      regularization.reviewedBy = reviewedBy;
      regularization.reviewDate = new Date();
      regularization.reviewComments = reviewComments || regularization.reviewComments;
      
      // If approved, update the attendance record
    //   if (status === 'approved') {
    //     await updateAttendanceRecord(regularization);
    //   }
    }
    
    const updatedRegularization = await regularization.save();
    
    // Populate the response
    const populatedRegularization = await AttendanceRegularization.findById(updatedRegularization._id)
      .populate('employee', 'firstName lastName employeeId')
      .populate('company', 'name code')
      .populate('user', 'email profile')
      .populate('shift', 'name startTime endTime')
      .populate('reviewedBy', 'firstName lastName')
      .populate('createdBy', 'email profile');

    res.json(populatedRegularization);
  } catch (error) {
    console.log(error)
    res.status(400).json({ message: error.message });
  }
};

// Bulk update regularization requests
export const bulkUpdateRegularizations = async (req, res) => {
  try {
    const { ids, status, reviewComments } = req.body; 
    const reviewedBy = req.user?.id; // Assuming authentication middleware sets req.user

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Please provide an array of regularization IDs' });
    }

    if (!status || !['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status provided' });
    }

    // Update multiple documents
    await AttendanceRegularization.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status,
          reviewedBy,
          reviewDate: new Date(),
          reviewComments
        }
      }
    );

    // Fetch the updated records with population
    const updatedRegularizations = await AttendanceRegularization.find({ _id: { $in: ids } })
      .populate('employee', 'firstName lastName employeeId')
      .populate('company', 'name code')
      .populate('user', 'email profile')
      .populate('shift', 'name startTime endTime')
      .populate('reviewedBy', 'firstName lastName')
      .populate('createdBy', 'email profile');

    res.status(200).json({
      success: true,
      count: updatedRegularizations.length,
      data: updatedRegularizations
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: error.message });
  }
};


// Helper function to update attendance record when regularization is approved
// async function updateAttendanceRecord(regularization) {
//   try {
//     const { employee, date, shift, requestedInTime, requestedOutTime } = regularization;
    
//     // Find or create attendance record
//     let attendance = await Attendance.findOne({ employee, date });
    
//     if (!attendance) {
//       attendance = new Attendance({
//         employee,
//         company: regularization.company,
//         date,
//         shift
//       });
//     }
    
//     // Update attendance with regularized times
//     attendance.inTime = requestedInTime;
//     attendance.outTime = requestedOutTime;
//     attendance.shift = shift;
//     attendance.regularized = true;
//     attendance.regularizationRequest = regularization._id;
    
//     // Calculate total hours
//     const calculateHours = (inTime, outTime) => {
//       const [inHours, inMinutes] = inTime.split(':').map(Number);
//       const [outHours, outMinutes] = outTime.split(':').map(Number);
      
//       let totalMinutes = (outHours * 60 + outMinutes) - (inHours * 60 + inMinutes);
//       if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts
      
//       return totalMinutes / 60;
//     };
    
//     attendance.totalHours = calculateHours(requestedInTime, requestedOutTime);
    
//     // Determine status based on shift timing
//     const shiftDetails = await Shift.findById(shift);
//     if (shiftDetails) {
//       const [shiftStartHours, shiftStartMinutes] = shiftDetails.startTime.split(':').map(Number);
//       const shiftStartTotalMinutes = shiftStartHours * 60 + shiftStartMinutes;
      
//       const [inHours, inMinutes] = requestedInTime.split(':').map(Number);
//       const inTotalMinutes = inHours * 60 + inMinutes;
      
//       // Check if late
//       if (inTotalMinutes > shiftStartTotalMinutes + shiftDetails.gracePeriod) {
//         attendance.lateMinutes = inTotalMinutes - shiftStartTotalMinutes;
//         attendance.status = 'late';
//       } else {
//         attendance.status = 'present';
//       }
//     }
    
//     await attendance.save();
//   } catch (error) {
//     console.error('Error updating attendance record:', error);
//     throw error;
//   }
// }





// Delete a regularization request
export const deleteRegularization = async (req, res) => {
  try {
    const regularization = await AttendanceRegularization.findById(req.params.id);
    if (!regularization) {
      return res.status(404).json({ message: 'Regularization request not found' });
    }
    
    // Check if regularization is already approved
    if (regularization.status === 'approved') {
      return res.status(400).json({ message: 'Cannot delete an approved regularization request' });
    }
    
    await AttendanceRegularization.findByIdAndDelete(req.params.id);
    res.json({ message: 'Regularization request deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};