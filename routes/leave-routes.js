import express from 'express';
import {
  applyLeave,
  managerApprove,
  hrApprove,
  adminApprove,
  rejectLeave,
  getPendingLeavesByLevel,
  cancelLeave,
  bulkUpdateLeaves,
  getCancelledLeavesForCompany,
  getLeavesForManager
} from '../controllers/leave-controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Leave Application
 */
router.post('/apply', protect, applyLeave);

/**
 * Approval Flow
 */
router.put('/:id/manager-approve', protect, restrictTo('manager'), managerApprove);
router.put('/:id/hr-approve', protect, restrictTo('hr'), hrApprove);
router.put('/:id/admin-approve', protect, restrictTo('admin'), adminApprove);

/**
 * Rejection (any level)
 */
router.put('/:id/reject', protect, rejectLeave);

/**
 * Pending Leaves (by level)
 */
router.get('/pending/:level', protect, getPendingLeavesByLevel);

/**
 * Cancel Leave (by employee or admin)
 */
router.put('/:id/cancel', protect, cancelLeave);

/**
 * Bulk Approval / Rejection
 */
router.put('/bulk/update', protect, restrictTo('manager', 'hr', 'admin', 'superadmin'), bulkUpdateLeaves);

/**
 * Get Cancelled Leaves for Company
 */
router.get('/company/:companyId/cancelled', protect, getCancelledLeavesForCompany);

/**
 * Manager-specific view (leaves from their department employees)
 */
router.get('/manager/leaves', protect, restrictTo('manager'), getLeavesForManager);

export default router;
