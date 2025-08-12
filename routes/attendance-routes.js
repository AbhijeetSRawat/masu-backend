// routes/attendance-routes.js
import express from 'express';
import {
  markAttendance,
  updateAttendanceTime,
  getEmployeeAttendance,
  getCompanyAttendance
} from '../controllers/attendance-controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// 🟢 Mark attendance
router.post('/', protect, markAttendance);

// 🟡 Update in/out time for a given attendance record
router.put('/:id', protect, updateAttendanceTime);

// 🔵 Get all attendance of a company
router.get('/company/:companyId', protect, getCompanyAttendance);

// 🔵 Get all attendance of a specific employee
router.get('/employee/:employeeId', protect, getEmployeeAttendance);

export default router;
