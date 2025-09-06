// routes/reimbursement-routes.js
// routes/reimbursement-routes.js
import express from 'express';
import {
  createReimbursement,
  updateReimbursementStatus,
  getCompanyReimbursements,
  getEmployeeReimbursements,
  bulkUpdateReimbursementStatus
} from '../controllers/reimbursement-controllers.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';


const router = express.Router();

router.post('/', protect, createReimbursement);
router.put('/:id/status', protect, updateReimbursementStatus);
router.get('/company/:companyId', protect, getCompanyReimbursements);
router.get('/employee/:employeeId', protect, getEmployeeReimbursements);
router.patch('/bulkupdate', protect, restrictTo("superadmin", "admin","subadmin"), bulkUpdateReimbursementStatus);

export default router;
