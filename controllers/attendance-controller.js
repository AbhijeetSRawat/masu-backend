import Attendance from '../models/Attendance.js';
import Company from '../models/Company.js';
import Department from '../models/Department.js';
import Employee from '../models/Employee.js';
import Shifts from '../models/Shifts.js';
import User from '../models/User.js';


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
      .populate({
        path: 'employee',
        populate: {
          path: 'user', select: 'profile email'
        }
      })
      .populate('company', 'name email')
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
    // const { inTime, outTime } = req.body;
    const { employee, company, date, shift,  notes, status } = req.body;
    
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
      const shiftExists = await Shifts.findOne({ _id: shift, company: company });
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
      // inTime,
      // outTime,
      status: status || 'absent',
      notes
    });
    
    // Calculate total hours and determine status
    // if (inTime && outTime) {
    //   const totalHours = calculateHours(inTime, outTime);
    //   attendance.totalHours = totalHours;
      
    //   // Determine status based on shift timing if shift is available
    //   if (attendance.shift) {
    //     const shiftDetails = await Shift.findById(attendance.shift);
    //     if (shiftDetails) {
    //       const [shiftStartHours, shiftStartMinutes] = shiftDetails.startTime.split(':').map(Number);
    //       const shiftStartTotalMinutes = shiftStartHours * 60 + shiftStartMinutes;
          
    //       const [inHours, inMinutes] = inTime.split(':').map(Number);
    //       const inTotalMinutes = inHours * 60 + inMinutes;
          
    //       // Check if late
    //       if (inTotalMinutes > shiftStartTotalMinutes + shiftDetails.gracePeriod) {
    //         attendance.lateMinutes = inTotalMinutes - shiftStartTotalMinutes;
    //         attendance.status = 'late';
    //       } else {
    //         attendance.status = 'present';
    //       }
          
    //       // Check if half day
    //       if (totalHours < shiftDetails.halfDayThreshold) {
    //         attendance.status = 'half_day';
    //       }
    //     }
    //   }
    // } else if (!inTime && !outTime) {
    //   attendance.status = 'absent';
    // }
    
    const newAttendance = await attendance.save();
 
    // Populate the response
    const populatedAttendance = await Attendance.findById(newAttendance._id)
      .populate({
        path: 'employee',
        populate: {
          path: 'user', select: 'profile email'
        }
      })
      .populate('company', 'name email')
      .populate('shift', 'name startTime endTime');
    
    res.status(201).json(populatedAttendance);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Bulk create attendance records
export const bulkCreateAttendance = async (req, res) => {
  try {
    const { attendances, company } = req.body;
    // attendances: [{ employee, date, shift, notes, status }, ...]

    if (!Array.isArray(attendances) || attendances.length === 0) {
      return res.status(400).json({ message: 'No attendance data provided' });
    }

    // Check if company exists
    const companyExists = await Company.findById(company);
    if (!companyExists) {
      return res.status(404).json({ message: 'Company not found' });
    }

    let results = [];
    for (const record of attendances) {
      const { employee, date, shift, notes, status } = record;

      // Validate employee
      const employeeExists = await Employee.findById(employee);
      if (!employeeExists) {
        results.push({ employee, success: false, message: 'Employee not found' });
        continue;
      }

      // Validate shift if provided
      if (shift) {
        const shiftExists = await Shifts.findOne({ _id: shift, company });
        if (!shiftExists) {
          results.push({ employee, success: false, message: 'Shift not found' });
          continue;
        }
      }

      // Check for existing attendance
      const existingAttendance = await Attendance.findOne({
        employee,
        date: new Date(date)
      });

      if (existingAttendance) {
        results.push({ employee, success: false, message: 'Attendance already exists' });
        continue;
      }

      const attendance = new Attendance({
        employee,
        company,
        date: new Date(date),
        shift: shift || employeeExists.shift,
        status: status || 'absent',
        notes
      });

      const saved = await attendance.save();

      results.push({ employee, success: true, attendanceId: saved._id });
    }

    return res.status(201).json({
      message: 'Bulk attendance process completed',
      results
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

export const getEmployeesUnderHRorManager = async (req, res) => {
  try {
    const { userId } = req.params; // logged-in HR/Manager's userId
    const { page = 1, limit = 10 } = req.query;

    // 1. Find employee record for this user
    const employee = await Employee.findOne({ user: userId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found for this user" });
    }

    // 2. Find department where this employee is assigned as HR or Manager
    const department = await Department.findOne({
      $or: [{ hr: employee._id }, { manager: employee._id }],
    });
    if (!department) {
      return res.status(404).json({ message: "No department found for this HR/Manager" });
    }

    // 3. Pagination setup
    const skip = (Number(page) - 1) * Number(limit);

    // 4. Fetch employees with pagination
    const [employees, total] = await Promise.all([
      Employee.find({
        "employmentDetails.department": department._id,
        isActive: true,
      })
       .populate({
          path: "employmentDetails.department",
         
        })
        .populate({
          path: "user",
          select: "email profile role",
        })
        .skip(skip)
        .limit(Number(limit)),

      Employee.countDocuments({
        "employmentDetails.department": department._id,
        isActive: true,
      }),
    ]);

    return res.status(200).json({
      message: "Employees fetched successfully",
      department: {
        id: department._id,
        name: department.name,
      },
      page: Number(page),
      limit: Number(limit),
      totalEmployees: total,
      totalPages: Math.ceil(total / limit),
      employees,
    });
  } catch (error) {
    console.error("[GET_EMPLOYEES_UNDER_HR_MANAGER_ERROR]", error);
    return res.status(500).json({
      message: "Internal server error while fetching employees",
      error: error.message,
    });
  }
};


export const getAttendanceByDate = async (req, res) => {
  try {
    const { date, startDate, endDate, companyId, page = 1, limit = 10 } = req.query;
    const { userId } = req.params; // logged-in HR/Manager's userId

    let filter = {};

    // Company filter (mandatory for HR/Managers)
    if (companyId) filter.company = companyId;

    // Date filter
    if (date) {
      filter.date = new Date(date);
    } else if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Check user role
    const currentEmployee = await Employee.findOne({ user: userId }).populate(
      "user",
      "role"
    );

    if (!currentEmployee) {
      return res.status(403).json({ message: "Not an employee of this company" });
    }

 

    if (currentEmployee?.user?.role === "hr") {
      // HR → sees all employees in the company
      filter.company = currentEmployee.company;
    } else if (currentEmployee?.user?.role === "manager") {
      // Manager → sees only their team
       filter.company = currentEmployee.company;
    } else {
      return res.status(403).json({ message: "Access denied. Only HR or Manager can view this." });
    }

    // Pagination setup
    const skip = (Number(page) - 1) * Number(limit);

    const [attendances, total] = await Promise.all([
      Attendance.find(filter)
        .populate({
          path: "employee",
          populate: { path: "user", select: "profile email" },
        })
        .populate("company", "name email")
        .populate("shift", "name startTime endTime")
        .populate("regularizationRequest")
        .sort({ date: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Attendance.countDocuments(filter),
    ]);

    return res.json({
      message: "Attendances fetched successfully",
      page: Number(page),
      limit: Number(limit),
      totalRecords: total,
      totalPages: Math.ceil(total / limit),
      attendances,
    });
  } catch (error) {
    console.error("[GET_ATTENDANCE_BY_DATE_ERROR]", error);
    res.status(500).json({ message: error.message });
  }
};

// ==============================
// Update Attendance (Only HR)
// ==============================
export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params; // attendance record id
    const  userId  = req?.user?._id; // logged-in userId (HR)
    const { status, notes, shift, date } = req.body;

    // Verify if user is HR
    const currentUser = await User.findById(userId);
   if (
  !currentUser ||
  !["hr", "admin", "superadmin","manager"].includes(currentUser?.role)
) {
  return res.status(403).json({
    message: "Access denied. Only HR, Manager, Admin or Superadmin can update attendance."
  });
}

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    // Update fields
    if (status) attendance.status = status;
    if (notes) attendance.notes = notes;
    if (shift) attendance.shift = shift;
    if (date) attendance.date = new Date(date);

    const updatedAttendance = await attendance.save();

    const populatedAttendance = await Attendance.findById(updatedAttendance._id)
      .populate({ path: "employee", populate: { path: "user", select: "profile email" } })
      .populate("company", "name email")
      .populate("shift", "name startTime endTime");

    return res.status(200).json({
      message: "Attendance updated successfully",
      attendance: populatedAttendance,
    });
  } catch (error) {
    console.error("[UPDATE_ATTENDANCE_ERROR]", error);
    return res.status(500).json({ message: error.message });
  }
};

// ==============================
// Bulk Update Attendance (Only HR)
// ==============================
export const bulkUpdateAttendance = async (req, res) => {
  try {
    const  userId  = req?.user?._id; // logged-in HR userId
    const { updates } = req.body;
    // updates: [{ attendanceId, status, notes, shift, date }, ...]

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "No updates provided" });
    }

    // Verify if user is HR
     const currentUser = await User.findById(userId);
   if (
  !currentUser ||
  !["hr", "admin", "superadmin","manager"].includes(currentUser?.role)
) {
  return res.status(403).json({
    message: "Access denied. Only HR, Manager, Admin or Superadmin  can update attendance."
  });
}

    let results = [];
    for (const record of updates) {
      const { attendanceId, status, notes, shift, date } = record;

      const attendance = await Attendance.findById(attendanceId);
      if (!attendance) {
        results.push({ attendanceId, success: false, message: "Attendance not found" });
        continue;
      }

      if (status) attendance.status = status;
      if (notes) attendance.notes = notes;
      if (shift) attendance.shift = shift;
      if (date) attendance.date = new Date(date);

      await attendance.save();

      results.push({ attendanceId, success: true, message: "Updated successfully" });
    }

    return res.status(200).json({
      message: "Bulk update process completed",
      results,
    });
  } catch (error) {
    console.error("[BULK_UPDATE_ATTENDANCE_ERROR]", error);
    return res.status(500).json({ message: error.message });
  }
};
