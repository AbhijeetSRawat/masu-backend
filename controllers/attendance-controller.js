import Attendance from '../models/Attendance.js';
import Company from '../models/Company.js';
import Employee from '../models/Employee.js';
import Shifts from '../models/Shifts.js';
// Get all attendance records
export const getAttendances = async (req, res) => {
  try {
    const { companyId, employeeId, startDate, endDate, status } = req.query;
    
    let filter = {};
    if (companyId) filter.company = companyId;
    if (employeeId) filter.employee = employeeId;
    if (status) filter.status = status;
    
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const attendances = await Attendance.find(filter)
      .populate('employee', 'firstName lastName employeeId department designation')
      .populate('company', 'name code')
      .populate('shift', 'name startTime endTime')
      .populate('regularizationRequest')
      .sort({ date: -1 });
    
    res.json(attendances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single attendance record
export const getAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId department designation')
      .populate('company', 'name code')
      .populate('shift', 'name startTime endTime')
      .populate('regularizationRequest');
    
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new attendance record
export const createAttendance = async (req, res) => {
  try {
    const { employee, company, date, shift, inTime, outTime, notes } = req.body;
    
    // Check if employee exists
    const employeeExists = await Employee.findById(employee);
    if (!employeeExists) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    // Check if company exists
    const companyExists = await Company.findById(company);
    if (!companyExists) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    // Check if shift exists (if provided)
    if (shift) {
      const shiftExists = await Shifts.findById(shift);
      if (!shiftExists) {
        return res.status(404).json({ message: 'Shift not found' });
      }
    }
    
    // Check if attendance already exists for this date and employee
    const existingAttendance = await Attendance.findOne({
      employee,
      date: new Date(date)
    });
    
    if (existingAttendance) {
      return res.status(400).json({ message: 'Attendance record already exists for this date' });
    }
    
    const attendance = new Attendance({
      employee,
      company,
      date: new Date(date),
      shift: shift || employeeExists.shift,
      inTime,
      outTime,
      notes
    });
    
    // Calculate total hours and determine status
    if (inTime && outTime) {
      const totalHours = calculateHours(inTime, outTime);
      attendance.totalHours = totalHours;
      
      // Determine status based on shift timing if shift is available
      if (attendance.shift) {
        const shiftDetails = await Shift.findById(attendance.shift);
        if (shiftDetails) {
          const [shiftStartHours, shiftStartMinutes] = shiftDetails.startTime.split(':').map(Number);
          const shiftStartTotalMinutes = shiftStartHours * 60 + shiftStartMinutes;
          
          const [inHours, inMinutes] = inTime.split(':').map(Number);
          const inTotalMinutes = inHours * 60 + inMinutes;
          
          // Check if late
          if (inTotalMinutes > shiftStartTotalMinutes + shiftDetails.gracePeriod) {
            attendance.lateMinutes = inTotalMinutes - shiftStartTotalMinutes;
            attendance.status = 'late';
          } else {
            attendance.status = 'present';
          }
          
          // Check if half day
          if (totalHours < shiftDetails.halfDayThreshold) {
            attendance.status = 'half_day';
          }
        }
      }
    } else if (!inTime && !outTime) {
      attendance.status = 'absent';
    }
    
    const newAttendance = await attendance.save();
    
    // Populate the response
    const populatedAttendance = await Attendance.findById(newAttendance._id)
      .populate('employee', 'firstName lastName employeeId')
      .populate('company', 'name code')
      .populate('shift', 'name startTime endTime');
    
    res.status(201).json(populatedAttendance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update an attendance record
export const updateAttendance = async (req, res) => {
  try {
    const { inTime, outTime, shift, notes, status } = req.body;
    
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    attendance.inTime = inTime !== undefined ? inTime : attendance.inTime;
    attendance.outTime = outTime !== undefined ? outTime : attendance.outTime;
    attendance.shift = shift !== undefined ? shift : attendance.shift;
    attendance.notes = notes !== undefined ? notes : attendance.notes;
    attendance.status = status !== undefined ? status : attendance.status;
    
    // Recalculate total hours if inTime or outTime changed
    if (inTime !== undefined || outTime !== undefined) {
      if (attendance.inTime && attendance.outTime) {
        attendance.totalHours = calculateHours(attendance.inTime, attendance.outTime);
        
        // Determine status based on shift timing if shift is available
        if (attendance.shift) {
          const shiftDetails = await Shift.findById(attendance.shift);
          if (shiftDetails) {
            const [shiftStartHours, shiftStartMinutes] = shiftDetails.startTime.split(':').map(Number);
            const shiftStartTotalMinutes = shiftStartHours * 60 + shiftStartMinutes;
            
            const [inHours, inMinutes] = attendance.inTime.split(':').map(Number);
            const inTotalMinutes = inHours * 60 + inMinutes;
            
            // Check if late
            if (inTotalMinutes > shiftStartTotalMinutes + shiftDetails.gracePeriod) {
              attendance.lateMinutes = inTotalMinutes - shiftStartTotalMinutes;
              attendance.status = 'late';
            } else {
              attendance.status = 'present';
            }
            
            // Check if half day
            if (attendance.totalHours < shiftDetails.halfDayThreshold) {
              attendance.status = 'half_day';
            }
          }
        }
      } else {
        attendance.status = 'absent';
        attendance.totalHours = 0;
      }
    }
    
    const updatedAttendance = await attendance.save();
    
    // Populate the response
    const populatedAttendance = await Attendance.findById(updatedAttendance._id)
      .populate('employee', 'firstName lastName employeeId')
      .populate('company', 'name code')
      .populate('shift', 'name startTime endTime');
    
    res.json(populatedAttendance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete an attendance record
export const deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }
    
    await Attendance.findByIdAndDelete(req.params.id);
    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to calculate hours between two times
function calculateHours(inTime, outTime) {
  const [inHours, inMinutes] = inTime.split(':').map(Number);
  const [outHours, outMinutes] = outTime.split(':').map(Number);
  
  let totalMinutes = (outHours * 60 + outMinutes) - (inHours * 60 + inMinutes);
  if (totalMinutes < 0) totalMinutes += 24 * 60; // Handle overnight shifts
  
  return totalMinutes / 60;
}