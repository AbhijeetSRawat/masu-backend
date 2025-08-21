// routes/leaveRoutes.js
// routes/leaveRoutes.js
import express from 'express';
import {
  applyLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
  getEmployeeLeaves,
  getLeavesForCompany,
  getApprovedLeavesForCompany,
  getPendingLeavesForCompany,
  getCancelledLeavesForCompany,
  getRejectedLeavesForCompany,
  getRestLeaveOfEmployee,
} from '../controllers/leave-controller.js';
import { protect,restrictTo } from '../middleware/authMiddleware.js';
import { getEmployeeLeaveSummary, getLeaveStatistics } from '../controllers/leaveReport-controller.js';


const r = express.Router();

// Apply for leave
r.post('/leaves/apply', protect, applyLeave);

// Approve leave (admin/manager action)
r.patch('/leaves/:id/approve', protect, restrictTo("superadmin", "admin"), approveLeave);

// Reject leave (admin/manager action)
r.patch('/leaves/:id/reject', protect, restrictTo("superadmin", "admin"), rejectLeave);

// Cancel leave (employee action)
r.patch('/leaves/:id/cancel', protect, cancelLeave);

// Get all leaves for an employee
r.get('/leaves/:companyId/:employeeId', protect, getEmployeeLeaves);

r.get('/leaves/:companyId', protect, restrictTo("superadmin", "admin"), getLeavesForCompany);
r.get('/approvedleaves/:companyId', protect, restrictTo("superadmin", "admin"), getApprovedLeavesForCompany);
r.get('/pendingleaves/:companyId', protect, restrictTo("superadmin", "admin"), getPendingLeavesForCompany);
r.get('/cancelledleaves/:companyId', protect, restrictTo("superadmin", "admin"), getCancelledLeavesForCompany);
r.get('/rejectedleaves/:companyId', protect, restrictTo("superadmin", "admin"), getRejectedLeavesForCompany);


// routes/leaveRoutes.js
r.get('/:employeeId/summary', getRestLeaveOfEmployee);
r.get('/:companyId/:year', getLeaveStatistics);

export default r;
