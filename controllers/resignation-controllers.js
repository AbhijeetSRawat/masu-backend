import Resignation from '../models/Resignation.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';

// Employee applies for resignation
export const applyForResignation = async (req, res) => {
  try {
    const { resignationDate, reason, feedback } = req.body;
    const userId = req.user._id;
    
    // Get employee details
    const employee = await Employee.findOne({ user: userId })
      .populate('company');
    
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    
    if (employee.employmentDetails.resignation.applied) {
      return res.status(400).json({ message: 'Resignation already applied' });
    }
    
    // Calculate proposed last working date based on notice period
    const noticePeriodDays = employee.employmentDetails.noticePeriod || 30;
    const proposedLastWorkingDate = new Date(resignationDate);
    proposedLastWorkingDate.setDate(proposedLastWorkingDate.getDate() + noticePeriodDays);
    
    // Create resignation record
    const resignation = new Resignation({
      employee: employee._id,
      user: userId,
      company: employee.company,
      resignationDate: new Date(resignationDate),
      proposedLastWorkingDate,
      reason,
      feedback
    });
    
    await resignation.save();
    
    // Update employee status
    await Employee.findByIdAndUpdate(employee._id, {
      'employmentDetails.status': 'notice-period',
      'employmentDetails.resignation.applied': true,
      'employmentDetails.resignation.appliedDate': new Date(),
      'employmentDetails.resignation.lastWorkingDate': proposedLastWorkingDate
    });
    
    res.status(201).json({
      message: 'Resignation applied successfully',
      resignation
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
};

// Admin approves resignation
export const approveResignation = async (req, res) => {
  try {
    const { resignationId, actualLastWorkingDate, notes } = req.body;
    const approvedBy = req.user._id;
    
    const resignation = await Resignation.findById(resignationId)
      .populate('employee');
    
    if (!resignation) {
      return res.status(404).json({ message: 'Resignation not found' });
    }
    
    if (resignation.status !== 'pending') {
      return res.status(400).json({ 
        message: `Resignation is already ${resignation.status}` 
      });
    }
    
    // Update resignation
    resignation.status = 'approved';
    resignation.approvedBy = approvedBy;
    resignation.approvalDate = new Date();
    resignation.actualLastWorkingDate = actualLastWorkingDate || 
      resignation.proposedLastWorkingDate;
    
    await resignation.save();
    
    // Update employee status
    await Employee.findByIdAndUpdate(resignation.employee._id, {
      'employmentDetails.status': 'resigned',
      'employmentDetails.resignation.approvedDate': new Date(),
      'employmentDetails.resignation.lastWorkingDate': resignation.actualLastWorkingDate,
      'employmentDetails.lastWorkingDate': resignation.actualLastWorkingDate
    });
    
    res.json({
      message: 'Resignation approved successfully',
      resignation
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get resignations with filters
export const getResignations = async (req, res) => {
  try {
    const { status, companyId, page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (companyId) query.company = companyId;
    
    const resignations = await Resignation.find(query)
      .populate('employee', 'employmentDetails.employeeId')
      .populate('user', 'email profile')
      .populate('approvedBy', 'profile')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Resignation.countDocuments(query);
    
    res.json({
      resignations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Withdraw resignation (employee)
export const withdrawResignation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { resignationId } = req.params;
    
    const resignation = await Resignation.findOne({
      _id: resignationId,
      user: userId
    });
    
    if (!resignation) {
      return res.status(404).json({ message: 'Resignation not found' });
    }
    
    if (resignation.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Cannot withdraw already processed resignation' 
      });
    }
    
    resignation.status = 'withdrawn';
    await resignation.save();
    
    // Revert employee status
    await Employee.findOneAndUpdate({ user: userId }, {
      'employmentDetails.status': 'active',
      'employmentDetails.resignation.applied': false,
      'employmentDetails.resignation.appliedDate': null,
      'employmentDetails.resignation.lastWorkingDate': null
    });
    
    res.json({ message: 'Resignation withdrawn successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeResignation = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find the employee
    const employee = await Employee.findById(employeeId)
      .populate('user', 'email role')
      .populate('company', 'name');

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Authorization check
    // Employees can only view their own resignation
    // Admins/HR can view any resignation
    if (userRole === 'employee' && employee.user._id.toString() !== userId) {
      return res.status(403).json({ 
        message: 'Not authorized to view this resignation' 
      });
    }

    // Find resignation for this employee
    const resignations = await Resignation.find({ employee: employeeId })
      .populate('approvedBy', 'profile firstName lastName')
      .populate('exitInterview.conductedBy', 'profile firstName lastName');

    if (!resignations || resignations.length === 0) {
      return res.status(404).json({
        message: 'No resignation found for this employee',
        hasResignation: false
      });
    }

    res.json({
      message: 'Resignation data retrieved successfully',
      hasResignation: true,
      resignations,
      employee: {
        id: employee._id,
        employeeId: employee.employmentDetails.employeeId,
        name: `${employee.personalDetails?.firstName || ''} ${employee.personalDetails?.lastName || ''}`.trim(),
        department: employee.employmentDetails.department,
        designation: employee.employmentDetails.designation
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Admin/HR rejects a resignation
export const rejectResignation = async (req, res) => {
  try {
    const { resignationId, rejectionReason } = req.body;
    const rejectedBy = req.user.id;

    const resignation = await Resignation.findById(resignationId)
      .populate('employee');

    if (!resignation) {
      return res.status(404).json({ message: 'Resignation not found' });
    }

    if (resignation.status !== 'pending') {
      return res.status(400).json({ 
        message: `Cannot reject resignation with status: ${resignation.status}` 
      });
    }

    // Update resignation status to rejected
    resignation.status = 'rejected';
    resignation.rejectionReason = rejectionReason;
    resignation.approvedBy = rejectedBy;
    resignation.approvalDate = new Date();
    await resignation.save();

    // Revert employee status back to active
    await Employee.findByIdAndUpdate(resignation.employee._id, {
      'employmentDetails.status': 'active',
      'employmentDetails.resignation.applied': false,
      'employmentDetails.resignation.appliedDate': null,
      'employmentDetails.resignation.lastWorkingDate': null
    });

    res.json({
      message: 'Resignation rejected successfully',
      resignation
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get resignation by ID
export const getResignationById = async (req, res) => {
  try {
    const { resignationId } = req.params;

    const resignation = await Resignation.findById(resignationId)
      .populate('employee', 'employmentDetails.employeeId personalDetails.firstName personalDetails.lastName employmentDetails.department employmentDetails.designation')
      .populate('user', 'email profile')
      .populate('approvedBy', 'profile firstName lastName')
      .populate('exitInterview.conductedBy', 'profile firstName lastName')
      .populate('company', 'name');

    if (!resignation) {
      return res.status(404).json({ message: 'Resignation not found' });
    }

    res.json({
      message: 'Resignation retrieved successfully',
      resignation
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// ✅ Bulk update resignations (approve/reject)
export const bulkUpdateResignations = async (req, res) => {
  try {
    const { ids, action, rejectionReason, actualLastWorkingDate, notes } = req.body;
    const userId = req.user._id;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "Resignation IDs are required" });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    const updatedResignations = [];

    for (const resignationId of ids) {
      const resignation = await Resignation.findById(resignationId).populate("employee");
      if (!resignation) continue;

      if (resignation.status !== "pending") continue; // skip already processed

      if (action === "reject") {
        resignation.status = "rejected";
        resignation.rejectionReason = rejectionReason || "";
        resignation.approvedBy = userId;
        resignation.approvalDate = new Date();

        await resignation.save();

        // Revert employee to active
        await Employee.findByIdAndUpdate(resignation.employee._id, {
          "employmentDetails.status": "active",
          "employmentDetails.resignation.applied": false,
          "employmentDetails.resignation.appliedDate": null,
          "employmentDetails.resignation.lastWorkingDate": null,
        });
      } else if (action === "approve") {
        resignation.status = "approved";
        resignation.approvedBy = userId;
        resignation.approvalDate = new Date();
        resignation.actualLastWorkingDate =
          actualLastWorkingDate || resignation.proposedLastWorkingDate;
        resignation.notes = notes || "";

        await resignation.save();

        // Update employee to resigned
        await Employee.findByIdAndUpdate(resignation.employee._id, {
          "employmentDetails.status": "resigned",
          "employmentDetails.resignation.approvedDate": new Date(),
          "employmentDetails.resignation.lastWorkingDate": resignation.actualLastWorkingDate,
          "employmentDetails.lastWorkingDate": resignation.actualLastWorkingDate,
        });
      }

      updatedResignations.push(resignation);
    }

    res.json({
      success: true,
      message: `Resignations ${action}d successfully`,
      count: updatedResignations.length,
      data: updatedResignations,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
