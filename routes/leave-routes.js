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
  bulkUpdateLeaves,
} from '../controllers/leave-controller.js';
import { protect,restrictTo } from '../middleware/authMiddleware.js';
import { getEmployeeLeaveSummary, getLeaveStatistics } from '../controllers/leaveReport-controller.js';


const r = express.Router();

// Apply for leave
r.post('/leaves/apply',  applyLeave);

// Approve leave (admin/manager action)
r.patch('/leaves/:id/approve', protect, restrictTo("superadmin", "admin","subadmin"), approveLeave);

// Reject leave (admin/manager action)
r.patch('/leaves/:id/reject', protect, restrictTo("superadmin", "admin","subadmin"), rejectLeave);

// Cancel leave (employee action)
r.patch('/leaves/:id/cancel', protect, cancelLeave);


r.patch('/bulkupdate', protect, restrictTo("superadmin", "admin","subadmin"), bulkUpdateLeaves);
// Get all leaves for an employee
r.get('/leaves/:companyId/:employeeId', protect, getEmployeeLeaves);

r.get('/leaves/:companyId', protect, restrictTo("superadmin", "admin","subadmin","hr","manager"), getLeavesForCompany);
r.get('/approvedleaves/:companyId', protect, restrictTo("superadmin", "admin","subadmin","hr","manager"), getApprovedLeavesForCompany);
r.get('/pendingleaves/:companyId', protect, restrictTo("superadmin", "admin","subadmin","hr","manager"), getPendingLeavesForCompany);
r.get('/cancelledleaves/:companyId', protect, restrictTo("superadmin", "admin","subadmin","hr","manager"), getCancelledLeavesForCompany);
r.get('/rejectedleaves/:companyId', protect, restrictTo("superadmin", "admin","subadmin","hr","manager"), getRejectedLeavesForCompany);


// routes/leaveRoutes.js
r.get('/:employeeId/summary', getRestLeaveOfEmployee);
r.get('/:companyId/:year', getLeaveStatistics);

export default r;
