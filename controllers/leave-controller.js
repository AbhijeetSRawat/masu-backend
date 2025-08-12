import Leave from '../models/Leave.js';
import Employee from '../models/Employee.js';

import { calculateLeaveDays } from '../utils/helper.js';

export const applyLeave = async (req, res, next) => {
  try {
  
    const {employeeId, type, startDate, endDate, reason, companyId } = req.body;

    const days = calculateLeaveDays(startDate, endDate);
    
    const newLeave = await Leave.create({
      employee: employeeId,
      company:companyId,
      type,
      startDate,
      endDate,
      days,
      reason,
      status: 'pending'
    });

    res.status(201).json({
      status: 'success',
      data: {
        leave: newLeave
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getLeave = async (req, res, next) => {
  try {
    const leave = await Leave.findById(req.params.leaveId)
      .populate('employee', 'employmentDetails.employeeId')
      .populate('approvedBy', 'employmentDetails.employeeId');

    if (!leave) {
     return res.status(404).json({ message: "Leave not found" });
    }

    res.status(200).json({
      status: 'success',
      data: {
        leave
      }
    });
  } catch (err) {
    next(err);
  }
};
export const updateLeave = async (req, res, next) => {
  try {
    const { id } = req.params; // leave ID
    const { type, startDate, endDate, reason } = req.body;

    // Recalculate days if startDate or endDate changed
    let updateFields = { type, startDate, endDate, reason };
    if (startDate && endDate) {
      updateFields.days = calculateLeaveDays(startDate, endDate);
    }

 

    const updatedLeave = await Leave.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true
    });

    if (!updatedLeave) {
      return res.status(404).json({ status: 'fail', message: 'Leave not found' });
    }

    res.status(200).json({
      status: 'success',
      data: {
        leave: updatedLeave
      }
    });
  } catch (err) {
    next(err);
  }
};


export const updateLeaveStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason, userId} = req.body;
    const { id } = req.params;

    const leave = await Leave.findByIdAndUpdate(
      id,
      {
        status,
        approvedBy: status === 'approved' ? userId : undefined,
        approvedAt: status === 'approved' ? new Date() : undefined,
        rejectionReason: status === 'rejected' ? rejectionReason : undefined
      },
      { new: true }
    );

    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }

    res.status(200).json({
      status: 'success',
      data: {
        leave
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getEmployeeLeaves = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const leaves = await Leave.find({ employee: employeeId })
      .sort('-startDate')
        .populate('employee', 'employmentDetails.employeeId')
      .populate('approvedBy', 'employmentDetails.employeeId');
;

    res.status(200).json({
      status: 'success',
      results: leaves.length,
      data: {
        leaves
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getCompanyLeaves = async (req, res, next) => {
  try {
    const  companyId  = req.params.id;
    
    const leaves = await Leave.find({ company: companyId })
      .populate('employee').populate('company').populate('approvedBy')
      .sort('-startDate');

    res.status(200).json({
      status: 'success',
      results: leaves.length,
      data: {
        leaves
      }
    });
  } catch (err) {
    next(err);
  }
};