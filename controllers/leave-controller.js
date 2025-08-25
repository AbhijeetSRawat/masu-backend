import mongoose from 'mongoose';
import Leave from '../models/Leave.js';
import LeavePolicy from '../models/LeavePolicy.js';
import { 
  // businessDaysBetween, 
  hasOverlappingLeaves, 
  validateLeaveType,
  checkLeaveTypeLimits,
  getCompanyPolicy,
  toYearFromPolicy,
  getPolicyYearStart,
  getPolicyYearEnd,
  getPolicyYearRange,
  businessDaysBetween
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



// validate leave type against policy

export const applyLeave = async (req, res) => {
  try {
    const leave = await withTransaction(async (session) => {
      let {
        employeeId,
        companyId,
        leaveBreakup = [],
        startDate,
        endDate,
        reason,
        isHalfDay = false,
        halfDayType = null,
      } = req.body;

      // ensure boolean
      isHalfDay = String(isHalfDay).toLowerCase() === "true";

      if (typeof leaveBreakup === "string") {
        try {
          leaveBreakup = JSON.parse(leaveBreakup);
        } catch (err) {
          throw new Error("Invalid leaveBreakup format");
        }
      }

      // required fields
      if (!employeeId || !companyId || !startDate || !endDate || !reason) {
        throw new Error("Missing required fields");
      }
      if (!Array.isArray(leaveBreakup) || leaveBreakup.length === 0) {
        throw new Error("At least one leave type required");
      }

      // validate half day
      if (isHalfDay && !["first-half", "second-half"].includes(halfDayType)) {
        throw new Error("Invalid half-day type");
      }

      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e < s) throw new Error("End date must be after start date");
      if (isHalfDay && s.toDateString() !== e.toDateString()) {
        throw new Error("Half-day must be a single day");
      }

      // get company policy
      const policy = await LeavePolicy.findOne({ company: companyId });
      if (!policy) throw new Error("Leave policy not found");

      // ---------------- FILE HANDLING ----------------
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
      if (filesToProcess.length > 0) {
        try {
          documentsArray = await Promise.all(
            filesToProcess.map(async (file, idx) => {
              const originalFileName =
                file.originalname || file.name || `Doc_${Date.now()}_${idx + 1}`;
              const uploaded = await uploadFileToCloudinary(
                file,
                process.env.FOLDER_NAME
              );
              return {
                name: originalFileName,
                url: uploaded?.result?.secure_url,
              };
            })
          );
        } catch (err) {
          console.error("Doc upload error:", err);
          throw new Error("Failed to upload documents");
        }
      }

      // ---------------- CALCULATE DAYS ----------------
      let businessDays = isHalfDay
        ? 0.5
        : await businessDaysBetween({
            companyId,
            start: s,
            end: e,
            excludeHoliday: !policy.sandwichLeave,
            includeWeekOff: policy.sandwichLeave,
          });

      if (businessDays <= 0) throw new Error("No business days in range");

      // ---------------- VALIDATE BREAKUP ----------------
      let totalDays = 0;
      for (const part of leaveBreakup) {
        if (!part.leaveType || !part.shortCode || !part.days) {
          throw new Error("Invalid leave breakup entry");
        }

        const typeDef = validateLeaveType(policy, part.leaveType);

        // min/max per request
        if (part.days > typeDef.maxPerRequest) {
          throw new Error(
            `${part.leaveType} exceeds max ${typeDef.maxPerRequest} days per request`
          );
        }
        if (part.days < typeDef.minPerRequest) {
          throw new Error(
            `${part.leaveType} requires min ${typeDef.minPerRequest} days`
          );
        }

        // yearly balance
        const yearStart = getPolicyYearStart(policy.yearStartMonth);
        const yearEnd = getPolicyYearEnd(policy.yearStartMonth);
        const yearLeaves = await Leave.aggregate([
          {
            $match: {
              employee: employeeId,
              company: companyId,
              "leaveBreakup.shortCode": part.shortCode,
              status: { $in: ["approved", "pending"] },
              startDate: { $gte: yearStart, $lte: yearEnd },
            },
          },
          { $unwind: "$leaveBreakup" },
          { $match: { "leaveBreakup.shortCode": part.shortCode } },
          { $group: { _id: null, total: { $sum: "$leaveBreakup.days" } } },
        ]);
        const usedYear = yearLeaves.length > 0 ? yearLeaves[0].total : 0;
        if (
          typeDef.maxInstancesPerYear &&
          usedYear + part.days > typeDef.maxInstancesPerYear
        ) {
          throw new Error(
            `${part.leaveType} yearly balance exceeded. Remaining: ${
              typeDef.maxInstancesPerYear - usedYear
            }`
          );
        }

        // monthly balance
        const monthStart = new Date(s.getFullYear(), s.getMonth(), 1);
        const monthEnd = new Date(s.getFullYear(), s.getMonth() + 1, 0);
        const monthLeaves = await Leave.aggregate([
          {
            $match: {
              employee: employeeId,
              company: companyId,
              "leaveBreakup.shortCode": part.shortCode,
              status: { $in: ["approved", "pending"] },
              startDate: { $gte: monthStart, $lte: monthEnd },
            },
          },
          { $unwind: "$leaveBreakup" },
          { $match: { "leaveBreakup.shortCode": part.shortCode } },
          { $group: { _id: null, total: { $sum: "$leaveBreakup.days" } } },
        ]);
        const usedMonth = monthLeaves.length > 0 ? monthLeaves[0].total : 0;
        if (
          typeDef.maxInstancesPerMonth &&
          usedMonth + part.days > typeDef.maxInstancesPerMonth
        ) {
          throw new Error(
            `${part.leaveType} monthly balance exceeded. Remaining: ${
              typeDef.maxInstancesPerMonth - usedMonth
            }`
          );
        }

        totalDays += part.days;
      }

    
      // ---------------- CHECK OVERLAP ----------------
      const overlap = await hasOverlappingLeaves(employeeId, companyId, s, e);
      if (overlap) throw new Error("Overlapping leave exists");

      // ---------------- CREATE LEAVE ----------------
      const leaveData = {
        employee: employeeId,
        company: companyId,
        leaveBreakup,
        totalDays,
        startDate: s,
        endDate: e,
        reason: reason.trim(),
        documents: documentsArray,
        isHalfDay,
        halfDayType: isHalfDay ? halfDayType : null,
        status: "pending",
      };

      const [newLeave] = await Leave.create([leaveData], { session });

      // auto approve if no approval needed
      let autoApprove = leaveBreakup.every((p) => {
        const def = validateLeaveType(policy, p.leaveType);
        return !def.requiresApproval;
      });
      if (autoApprove) {
        newLeave.status = "approved";
        newLeave.approvedBy = employeeId;
        newLeave.approvedAt = new Date();
        await newLeave.save({ session });
      }

      await newLeave.populate([
        { path: "employee", select: "name email" },
        { path: "company", select: "name" },
        { path: "approvedBy", select: "name email" },
      ]);

      return newLeave;
    });

    res.status(201).json({
      success: true,

      message:
        leave.status === "approved"
          ? "Leave auto-approved successfully"
          : "Leave submitted for approval",
      leave,
      documentsUploaded: leave.documents ? leave.documents.length : 0,
    });
  } catch (err) {
    console.error("Apply Leave Error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};


// export const approveLeave = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const approverId = req.user._id; // From auth middleware
//     const { comment } = req.body;

//     const leave = await withTransaction(async (session) => {
//       const leaveDoc = await Leave.findById(id).session(session);
//       if (!leaveDoc) {
//         throw new Error('Leave not found');
//       }

//       if (leaveDoc.status !== 'pending') {
//         throw new Error('Leave is not pending approval');
//       }

//       // Get policy to check if approval is needed
//       const policy = await getCompanyPolicy(leaveDoc.company);
//       const typeDef = validateLeaveType(policy, leaveDoc.leaveType);

//       // For types that don't require approval, just return as is
//       if (!typeDef.requiresApproval) {
//         return leaveDoc;
//       }

//       // Approve the leave
//       leaveDoc.status = 'approved';
//       leaveDoc.approvedBy = approverId;
//       leaveDoc.approvedAt = new Date();
//       leaveDoc.comment = comment || '';
//       await leaveDoc.save({ session });

//       return leaveDoc;
//     });

//     res.json({ 
//       success: true, 
//       message: 'Leave approved successfully',
//       leave 
//     });
//   } catch (error) {
//     res.status(400).json({ 
//       success: false, 
//       message: error.message 
//     });
//   }
// };

// export const rejectLeave = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { reason } = req.body;
//     const rejectorId = req.user._id; // From auth middleware

//     if (!reason) {
//       throw new Error('Rejection reason is required');
//     }

//     const leave = await Leave.findByIdAndUpdate(
//       id,
//       { 
//         status: 'rejected',
//         rejectionReason: reason,
//         approvedAt: new Date(),
//         rejectedBy: rejectorId
//       },
//       { new: true }
//     );

//     if (!leave) {
//       throw new Error('Leave not found');
//     }

//     res.json({ 
//       success: true, 
//       message: 'Leave rejected successfully',
//       leave 
//     });
//   } catch (error) {
//     res.status(400).json({ 
//       success: false, 
//       message: error.message 
//     });
//   }
// };

// export const cancelLeave = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const employeeId = req.user._id; // From auth middleware

//     const leave = await Leave.findOneAndUpdate(
//       { 
//         _id: id,
//        // employee: employeeId,
//         status: { $in: ['pending', 'approved'] } 
//       },
//       { status: 'cancelled' },
//       { new: true }
//     );

//     if (!leave) {
//       throw new Error('Leave not found or cannot be cancelled');
//     }

//     res.json({ 
//       success: true, 
//       message: 'Leave cancelled successfully',
//       leave 
//     });
//   } catch (error) {
//     console.log(error)
//     res.status(400).json({ 
//       success: false, 
//       message: error.message 
//     });
//   }
// };

// export const getEmployeeLeaves = async (req, res) => {
//   try {
//     const { employeeId, companyId } = req.params;
//     const { status, year, leaveType } = req.query;

//     let query = { 
//       employee: employeeId, 
//       company: companyId 
//     };

//     if (status) {
//       query.status = status;
//     }

//     if (year) {
//       const policy = await getCompanyPolicy(companyId);
//       const yearStartMonth = policy?.yearStartMonth || 1;
//       const start = new Date(year, yearStartMonth - 1, 1);
//       const end = new Date(parseInt(year) + 1, yearStartMonth - 1, 0);
      
//       query.startDate = { $gte: start, $lte: end };
//     }

//     if (leaveType) {
//       query.leaveType = leaveType;
//     }

//     const leaves = await Leave.find(query)
//       .sort({ startDate: -1 })
//       .populate('approvedBy rejectedBy', "profile email");

//     res.json({ 
//       success: true, 
//       count: leaves.length,
//       leaves 
//     });
//   } catch (error) {
//     res.status(400).json({ 
//       success: false, 
//       message: error.message 
//     });
//   }
// };


// ✅ Approve Leave
export const approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const approverId = req.user._id; // From auth middleware
    const { comment } = req.body;

    const leave = await withTransaction(async (session) => {
      const leaveDoc = await Leave.findById(id).session(session);
      if (!leaveDoc) {
        throw new Error("Leave not found");
      }

      if (leaveDoc.status !== "pending") {
        throw new Error("Leave is not pending approval");
      }

      // Get policy + validate
      const policy = await getCompanyPolicy(leaveDoc.company);

      // Check all leave types inside leaveBreakup
      leaveDoc.leaveBreakup.forEach((l) => {
        const typeDef = validateLeaveType(policy, l.leaveType);
        if (typeDef.requiresApproval === false) {
          // If any type doesn’t require approval → skip
          return leaveDoc;
        }
      });

      // ✅ Approve leave
      leaveDoc.status = "approved";
      leaveDoc.approvedBy = approverId;
      leaveDoc.approvedAt = new Date();
      leaveDoc.comment = comment || "";

      await leaveDoc.save({ session });
      return leaveDoc;
    });

    res.json({
      success: true,
      message: "Leave approved successfully",
      leave,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Reject Leave
export const rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const rejectorId = req.user._id; // From auth middleware

    if (!reason) {
      throw new Error("Rejection reason is required");
    }

    const leave = await Leave.findByIdAndUpdate(
      id,
      {
        status: "rejected",
        rejectionReason: reason,
        rejectedBy: rejectorId,
        rejectedAt: new Date(),
      },
      { new: true }
    );

    if (!leave) {
      throw new Error("Leave not found");
    }

    res.json({
      success: true,
      message: "Leave rejected successfully",
      leave,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ✅ Cancel Leave
export const cancelLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user._id; // From auth middleware

    const leave = await Leave.findOneAndUpdate(
      {
        _id: id,
    
        status: { $in: ["pending", "approved"] },
      },
      { status: "cancelled", cancelledAt: new Date() },
      { new: true }
    );

    if (!leave) {
      throw new Error("Leave not found or cannot be cancelled");
    }

    res.json({
      success: true,
      message: "Leave cancelled successfully",
      leave,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};



export const getEmployeeLeaves = async (req, res) => {
  try {
    const { employeeId, companyId } = req.params;
    const { status, year, leaveType, shortCode } = req.query;

    let query = {
      employee: employeeId,
      company: companyId
    };

    // ✅ filter by status
    if (status) {
      query.status = status;
    }

    // ✅ filter by policy year
    if (year) {
      const policy = await getCompanyPolicy(companyId);
      const yearStartMonth = policy?.yearStartMonth || 1;

      const start = new Date(year, yearStartMonth - 1, 1); 
      // 👆 first day of policy year
      const end = new Date(parseInt(year) + 1, yearStartMonth - 1, 0); 
      // 👆 last day before next policy year

      query.startDate = { $gte: start, $lte: end };
    }

    // ✅ filter by leave type (inside breakup array)
    if (leaveType) {
      query["leaveBreakup.leaveType"] = leaveType; 
    }

    // ✅ optional filter by shortCode
    if (shortCode) {
      query["leaveBreakup.shortCode"] = shortCode;
    }

    const leaves = await Leave.find(query)
      .sort({ startDate: -1 })
      .populate("approvedBy rejectedBy", "profile email")
      .populate("employee", "name email")
      .populate("company", "name");

    res.json({
      success: true,
      count: leaves.length,
      leaves
    });
  } catch (error) {
    console.error("Get Employee Leaves Error:", error);
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


// export const getRestLeaveOfEmployee = async (req,res) =>{
//           const {employeeId} = req.params;
//           const { year = new Date().getFullYear() } = req.query;

//           try {
//             // Get all leaves for the year
//             const yearStart = new Date(year, 0, 1);
//             const yearEnd = new Date(year, 11, 31);

//             const leaves = await Leave.find({
//               employee: employeeId,
//               startDate: { $gte: yearStart, $lte: yearEnd }
//             });

//             // Manual count calculation
//   const summary = leaves.reduce((acc, leave) => {
//   const leaveType = leave.leaveType; // 👈 correct field name from schema

//   if (!acc[leaveType]) {
//     acc[leaveType] = {
//       approved: { count: 0, days: 0 },
//       rejected: { count: 0, days: 0 },
//       pending: { count: 0, days: 0 },
//       cancelled: { count: 0, days: 0 },
//       totalDays: 0
//     };
//   }

//   acc[leaveType][leave.status].count += 1;
//   acc[leaveType][leave.status].days += leave.days;
//   acc[leaveType].totalDays += leave.days;

//   return acc;
// }, {});





//             res.json({
//               success: true,
//               summary,
//               year: parseInt(year),

//             });

//           } catch (error) {
//             res.status(500).json({
//               success: false,
//               message: error.message
//             });
//           }
// };

export const getRestLeaveOfEmployee = async (req, res) => {
  const { employeeId } = req.params;
  const { year = new Date().getFullYear() } = req.query;

  try {
    // Get all leaves for the year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);

    const leaves = await Leave.find({
      employee: employeeId,
      startDate: { $gte: yearStart, $lte: yearEnd }
    });

    // Summary object
    const summary = {};

    leaves.forEach((leave) => {
      const status = leave.status; // approved / rejected / pending / cancelled

      // Each leave can have multiple breakup items (e.g., 2 CL + 3 PL)
      leave.leaveBreakup.forEach((item) => {
        const { leaveType, shortCode, days } = item;

        if (!summary[leaveType]) {
          summary[leaveType] = {
            approved: { count: 0, days: 0 },
            rejected: { count: 0, days: 0 },
            pending: { count: 0, days: 0 },
            cancelled: { count: 0, days: 0 },
            totalDays: 0,
            shortCode
          };
        }

        // increment counts by status
        summary[leaveType][status].count += 1;
        summary[leaveType][status].days += days;

        // always add total days (irrespective of status)
        summary[leaveType].totalDays += days;
      });
    });

    res.json({
      success: true,
      employeeId,
      year: parseInt(year),
      summary
    });
  } catch (error) {
    console.error("getRestLeaveOfEmployee Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
