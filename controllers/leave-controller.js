import mongoose from 'mongoose';
import Leave from '../models/Leave.js';
import { 
  businessDaysBetween, 
  hasOverlappingLeaves, 
  validateLeaveType,
  checkLeaveTypeLimits,
  getCompanyPolicy,
  toYearFromPolicy,
  getPolicyYearStart,
  getPolicyYearEnd,
  getPolicyYearRange
} from '../services/leaveUtils.js';
import uploadFileToCloudinary from '../utils/fileUploader.js';

// Helper for transaction handling
const withTransaction = async (fn) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

import LeavePolicy from "../models/LeavePolicy.js";

const getMaxInstancesPerYear = async (companyId, shortCode) => {
  const policy = await LeavePolicy.findOne(
    { company: companyId, "leaveTypes.shortCode": shortCode.toUpperCase() },
    { "leaveTypes.$": 1 } // only return the matching leaveType
  );

  if (!policy || !policy.leaveTypes.length) {
    throw new Error(`Leave type ${shortCode} not found for this company`);
  }

  return policy.leaveTypes[0].maxInstancesPerYear; // ✅ your value
};


export const applyLeave = async (req, res) => {
  try {
    const leave = await withTransaction(async (session) => {
      let {
        employeeId,
        companyId,
        leaveType,
        shortCode,
        startDate,
        endDate,
        reason,
        isHalfDay = false,
        halfDayType = null
      } = req.body;

      const maxInstances = await getMaxInstancesPerYear(companyId, shortCode);

      


      // ✅ Ensure boolean type for isHalfDay
      isHalfDay = String(isHalfDay).toLowerCase() === "true";

      // ✅ Validate required fields
      if (!employeeId || !companyId || !leaveType || !shortCode || !startDate || !endDate || !reason) {
        throw new Error("Missing required fields");
      }

      // ✅ Validate half-day type if applicable
      if (isHalfDay && !["first-half", "second-half"].includes(halfDayType)) {
        throw new Error("Invalid half day type. Must be 'first-half' or 'second-half'");
      }

      // ✅ Get and validate company policy
      const policy = await getCompanyPolicy(companyId);
      if (!policy) {
        throw new Error("Leave policy not found for company");
      }

      // ✅ Validate leave type
      const typeDef = validateLeaveType(policy, leaveType);

      // ✅ Check leave type limits
      await checkLeaveTypeLimits(employeeId, companyId, leaveType, startDate);

      // ✅ Date validation
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e < s) {
        throw new Error("End date must be after start date");
      }

      // ✅ Half-day must be same date
      if (isHalfDay && s.toDateString() !== e.toDateString()) {
        throw new Error("Half day leave must be for the same day");
      }

      // -------------------- FILE UPLOAD HANDLING --------------------
      let documentsArray = [];
      let filesToProcess = [];

      if (req.files) {
        if (req.files.documents) {
          filesToProcess = Array.isArray(req.files.documents)
            ? req.files.documents
            : [req.files.documents];
        } else if (Array.isArray(req.files)) {
          filesToProcess = req.files;
        } else if (req.files.filename || req.files.path) {
          filesToProcess = [req.files];
        }
      }

      // ✅ Validate if documents are required
   

   
  
      // ---------------------------------------------------------------

      // ✅ Calculate business days
      let days = isHalfDay
        ? 0.5
        : await businessDaysBetween({ companyId, start: s, end: e , excludeHoliday: typeDef.excludeHolidays , includeWeekOff: policy.includeWeekOff});

      if (days <= 0) {
        throw new Error("No business days in selected range");
      }


        if (
        typeDef.requiresDocs &&
        typeDef.docsRequiredAfterDays !== null &&
        days > typeDef.docsRequiredAfterDays &&
        filesToProcess.length === 0
      ) {
        throw new Error(
          `Documents required if leave exceeds ${typeDef.docsRequiredAfterDays} days`
        );
      }

         // ✅ Upload files to Cloudinary

     if (filesToProcess.length > 0) {
        try {
          documentsArray = await Promise.all(
            filesToProcess.map(async (file, index) => {
              const originalFileName =
                file.originalname || file.name || `Document_${Date.now()}_${index + 1}`;
              const uploaded = await uploadFileToCloudinary(file,process.env.FOLDER_NAME);
        
              return {
                name: originalFileName,
                url: uploaded?.result?.secure_url
              };
            })
          );
        } catch (uploadError) {
          console.error("Document upload error:", uploadError);
          throw new Error("Failed to upload documents: " + uploadError.message);
        }
      }

      // ✅ Check leave type min/max constraints
      if (days > typeDef.maxPerRequest) {
        throw new Error(`Exceeds maximum ${typeDef.maxPerRequest} days per request`);
      }
      if (days < typeDef.minPerRequest) {
        throw new Error(`Minimum ${typeDef.minPerRequest} days required for this leave type`);
      }

      // ✅ Check overlapping leaves
      const overlap = await hasOverlappingLeaves(employeeId, companyId, s, e);
      if (overlap) {
        throw new Error("Overlapping leave request exists");
      }

       const leavesTaken = await Leave.aggregate([
          {
            $match: {
              employee: employeeId,
              company: companyId,
              shortCode: shortCode,
              status: { $in: ["approved", "pending"] }, // consider both approved & pending
              startDate: { $gte: getPolicyYearStart(policy.yearStartMonth), $lte: getPolicyYearEnd(policy.yearStartMonth) }
            }
          },
          {
            $group: {
              _id: null,
              totalDays: { $sum: "$days" }
            }
          }
        ]);

        const usedDays = leavesTaken.length > 0 ? leavesTaken[0].totalDays : 0;
          if (typeDef.maxInstancesPerYear && usedDays + days > typeDef.maxInstancesPerYear) {
        throw new Error(`Yearly balance exceeded. Remaining: ${typeDef.maxInstancesPerYear - usedDays}`);
      }

       // ✅ Balance check - Monthly
      const monthStart = new Date(s.getFullYear(), s.getMonth(), 1);
      const monthEnd = new Date(s.getFullYear(), s.getMonth() + 1, 0);
      const leavesTakenMonth = await Leave.aggregate([
        {
          $match: {
            employee: employeeId,
            company: companyId,
            shortCode,
            status: { $in: ["approved", "pending"] },
            startDate: { $gte: monthStart, $lte: monthEnd }
          }
        },
        { $group: { _id: null, totalDays: { $sum: "$days" } } }
      ]);
      const usedMonth = leavesTakenMonth.length > 0 ? leavesTakenMonth[0].totalDays : 0;
      if (typeDef.maxInstancesPerMonth && usedMonth + days > typeDef.maxInstancesPerMonth) {
        throw new Error(`Monthly balance exceeded. Remaining: ${typeDef.maxInstancesPerMonth - usedMonth}`);
      }

      
        
      // ✅ Create leave data
      const leaveData = {
        employee: employeeId,
        company: companyId,
        leaveType: leaveType,
        shortCode: shortCode,
        startDate: s,
        endDate: e,
        days,
        reason: reason.trim(),
        documents: documentsArray,
        isHalfDay,
        halfDayType: isHalfDay ? halfDayType : null,
        status: "pending"
      };

      // ✅ Save leave
      const [newLeave] = await Leave.create([leaveData], { session });

      // ✅ Auto-approve if no approval required
      if (!typeDef.requiresApproval) {
        newLeave.status = "approved";
        newLeave.approvedBy = employeeId;
        newLeave.approvedAt = new Date();
        await newLeave.save({ session });
      }

      // ✅ Populate references for response
      await newLeave.populate([
        { path: "employee", select: "name email" },
        { path: "company", select: "name" },
        { path: "approvedBy", select: "name email" }
      ]);

      return newLeave;
    });

    // ✅ Response
    res.status(201).json({
      success: true,
      message:
        leave.status === "approved"
          ? "Leave auto-approved successfully"
          : "Leave application submitted for approval",
      leave,
      documentsUploaded: leave.documents ? leave.documents.length : 0
    });
  } catch (error) {
    console.error("Apply Leave Error:", error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


export const approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const approverId = req.user._id; // From auth middleware
    const { comment } = req.body;

    const leave = await withTransaction(async (session) => {
      const leaveDoc = await Leave.findById(id).session(session);
      if (!leaveDoc) {
        throw new Error('Leave not found');
      }

      if (leaveDoc.status !== 'pending') {
        throw new Error('Leave is not pending approval');
      }

      // Get policy to check if approval is needed
      const policy = await getCompanyPolicy(leaveDoc.company);
      const typeDef = validateLeaveType(policy, leaveDoc.leaveType);

      // For types that don't require approval, just return as is
      if (!typeDef.requiresApproval) {
        return leaveDoc;
      }

      // Approve the leave
      leaveDoc.status = 'approved';
      leaveDoc.approvedBy = approverId;
      leaveDoc.approvedAt = new Date();
      leaveDoc.comment = comment || '';
      await leaveDoc.save({ session });

      return leaveDoc;
    });

    res.json({ 
      success: true, 
      message: 'Leave approved successfully',
      leave 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const rejectorId = req.user._id; // From auth middleware

    if (!reason) {
      throw new Error('Rejection reason is required');
    }

    const leave = await Leave.findByIdAndUpdate(
      id,
      { 
        status: 'rejected',
        rejectionReason: reason,
        approvedAt: new Date(),
        rejectedBy: rejectorId
      },
      { new: true }
    );

    if (!leave) {
      throw new Error('Leave not found');
    }

    res.json({ 
      success: true, 
      message: 'Leave rejected successfully',
      leave 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user._id; // From auth middleware

    const leave = await Leave.findOneAndUpdate(
      { 
        _id: id,
       // employee: employeeId,
        status: { $in: ['pending', 'approved'] } 
      },
      { status: 'cancelled' },
      { new: true }
    );

    if (!leave) {
      throw new Error('Leave not found or cannot be cancelled');
    }

    res.json({ 
      success: true, 
      message: 'Leave cancelled successfully',
      leave 
    });
  } catch (error) {
    console.log(error)
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getEmployeeLeaves = async (req, res) => {
  try {
    const { employeeId, companyId } = req.params;
    const { status, year, leaveType } = req.query;

    let query = { 
      employee: employeeId, 
      company: companyId 
    };

    if (status) {
      query.status = status;
    }

    if (year) {
      const policy = await getCompanyPolicy(companyId);
      const yearStartMonth = policy?.yearStartMonth || 1;
      const start = new Date(year, yearStartMonth - 1, 1);
      const end = new Date(parseInt(year) + 1, yearStartMonth - 1, 0);
      
      query.startDate = { $gte: start, $lte: end };
    }

    if (leaveType) {
      query.leaveType = leaveType;
    }

    const leaves = await Leave.find(query)
      .sort({ startDate: -1 })
      .populate('approvedBy rejectedBy', "profile email");

    res.json({ 
      success: true, 
      count: leaves.length,
      leaves 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getLeavesForCompany = async (req, res) => {
  const { companyId } = req.params;
  const { page = 1, limit = 10 } = req.query; // default values

  try {
    const skip = (page - 1) * limit;

    // Total count before pagination
    const total = await Leave.countDocuments({ company: companyId });

    // Paginated and sorted (-1 for descending)
    const leaves = await Leave.find({ company: companyId })
      .sort({ _id: -1 }) // descending order
      .skip(skip)
      .limit(Number(limit))
      .populate({
        path: 'employee',
        select: 'user',
        populate:{
          path: 'user',
          select:'profile'
        }
      });

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      count: leaves.length,
      leaves,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


export const getApprovedLeavesForCompany = async (req, res) => {
  const { companyId } = req.params;
  const { page = 1, limit = 10 } = req.query; // default values

  try {
    const skip = (page - 1) * limit;

    // Total count before pagination
    const total = await Leave.countDocuments({ company: companyId });

    // Paginated and sorted (-1 for descending)
    const leaves = await Leave.find({ company: companyId , status: 'approved' })
      .sort({ _id: -1 }) // descending order
      .skip(skip)
      .limit(Number(limit))
      .populate("approvedBy", "profile email")
      .populate({
        path: 'employee',
        select: 'user',
        populate:{
          path: 'user',
          select:'profile email'
        }
      });

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      count: leaves.length,
      leaves,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getRejectedLeavesForCompany = async (req, res) => {
  const { companyId } = req.params;
  const { page = 1, limit = 10 } = req.query; // default values

  try {
    const skip = (page - 1) * limit;

    // Total count before pagination
    const total = await Leave.countDocuments({ company: companyId });

    // Paginated and sorted (-1 for descending)
    const leaves = await Leave.find({ company: companyId , status: 'rejected' })
      .sort({ _id: -1 }) // descending order
      .skip(skip)
      .limit(Number(limit))
       .populate("rejectedBy", "profile email")
       .populate({
        path: 'employee',
        select: 'user',
        populate:{
          path: 'user',
          select:'profile email'
        }
      });

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      count: leaves.length,
      leaves,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getPendingLeavesForCompany = async (req, res) => {
  const { companyId } = req.params;
  const { page = 1, limit = 10 } = req.query; // default values

  try {
    const skip = (page - 1) * limit;

    // Total count before pagination
    const total = await Leave.countDocuments({ company: companyId });

    // Paginated and sorted (-1 for descending)
    const leaves = await Leave.find({ company: companyId , status: 'pending' })
      .sort({ _id: -1 }) // descending order
      .skip(skip)
      .limit(Number(limit))
       .populate({
        path: 'employee',
        select: 'user',
        populate:{
          path: 'user',
          select:'profile email'
        }
      });

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      count: leaves.length,
      leaves,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCancelledLeavesForCompany = async (req, res) => {
  const { companyId } = req.params;
  const { page = 1, limit = 10 } = req.query; // default values

  try {
    const skip = (page - 1) * limit;

    // Total count before pagination
    const total = await Leave.countDocuments({ company: companyId });

    // Paginated and sorted (-1 for descending)
    const leaves = await Leave.find({ company: companyId , status: 'cancelled' })
      .sort({ _id: -1 }) // descending order
      .skip(skip)
      .limit(Number(limit))
       .populate({
        path: 'employee',
        select: 'user',
        populate:{
          path: 'user',
          select:'profile email'
        }
      });

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      count: leaves.length,
      leaves,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


export const getRestLeaveOfEmployee = async (req,res) =>{
          const {employeeId} = req.params;
          const { year = new Date().getFullYear() } = req.query;

          try {
            // Get all leaves for the year
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);

            const leaves = await Leave.find({
              employee: employeeId,
              startDate: { $gte: yearStart, $lte: yearEnd }
            });

            // Manual count calculation
  const summary = leaves.reduce((acc, leave) => {
  const leaveType = leave.leaveType; // 👈 correct field name from schema

  if (!acc[leaveType]) {
    acc[leaveType] = {
      approved: { count: 0, days: 0 },
      rejected: { count: 0, days: 0 },
      pending: { count: 0, days: 0 },
      cancelled: { count: 0, days: 0 },
      totalDays: 0
    };
  }

  acc[leaveType][leave.status].count += 1;
  acc[leaveType][leave.status].days += leave.days;
  acc[leaveType].totalDays += leave.days;

  return acc;
}, {});





            res.json({
              success: true,
              summary,
              year: parseInt(year),

            });

          } catch (error) {
            res.status(500).json({
              success: false,
              message: error.message
            });
          }
};
