import express from 'express';


import { applyForResignation, approveResignation, bulkUpdateResignations, getEmployeeResignation, getResignationById, getResignations, rejectResignation, withdrawResignation } from '../controllers/resignation-controllers.js';
import { protect, restrictTo } from '../controllers/auth-controllers.js';

const router = express.Router();

// Employee routes
router.post('/apply', protect, restrictTo("superadmin", "admin", "employee","subadmin"), applyForResignation);
router.patch('/withdraw/:resignationId', protect, restrictTo("superadmin", "admin", "employee","subadmin"), withdrawResignation);

// Admin/HR routes
router.patch('/approve', protect, restrictTo("superadmin", "admin", "hr","subadmin"), approveResignation);
router.get('/', protect, restrictTo("superadmin","admin", "hr","subadmin"), getResignations);
router.get('/:employeeId', protect, restrictTo("superadmin", "admin", "hr","employee","subadmin"), getEmployeeResignation);
router.patch('/reject', protect, restrictTo("superadmin", "admin", "hr","subadmin"), rejectResignation);
router.get('/resignation/:resignationId', protect, restrictTo("superadmin", "admin", "hr","employee","subadmin"), getResignationById);
router.patch('/bulkupdate', protect, restrictTo("superadmin", "admin","subadmin"), bulkUpdateResignations);

export default router;