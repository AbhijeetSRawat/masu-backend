// routes/reimbursement-routes.js
// routes/reimbursement-routes.js
import express from 'express';
import {
  createReimbursement,
  updateReimbursementStatus,
  getCompanyReimbursements,
  getEmployeeReimbursements
} from '../controllers/reimbursement-controllers.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createReimbursement);
router.put('/:id/status', protect, updateReimbursementStatus);
router.get('/company/:companyId', protect, getCompanyReimbursements);
router.get('/employee/:employeeId', protect, getEmployeeReimbursements);

export default router;
