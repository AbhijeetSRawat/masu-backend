import express from 'express';
import {
  processPayroll,
  getEmployeePayroll,
  processBulkPayroll,
  generatePayrollReport
} from '../controllers/payrollNew-controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// Payroll processing routes
router.post('/process', restrictTo('superadmin','admin','hr','manager'), processPayroll);
router.post('/bulk', restrictTo('superadmin','admin','hr','manager'), processBulkPayroll);
router.get('/employee/:employeeId/:companyId', restrictTo('superadmin','admin','hr','manager','employee'), getEmployeePayroll);
router.get('/report', restrictTo('superadmin','admin','hr','manager'), generatePayrollReport);

export default router;