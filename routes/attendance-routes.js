// routes/attendance-routes.js
import express from 'express';
import {
  createAttendance,
  updateAttendance,
  getAttendances,
  getAttendance
} from '../controllers/attendance-controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// 🟢 Mark attendance
router.post('/', protect,  createAttendance);

// 🟡 Update in/out time for a given attendance record
router.put('/:id', protect, updateAttendance);

// 🔵 Get all attendance of a company
router.get('/company/:companyId', protect, getAttendances);

// 🔵 Get all attendance of a specific employee
router.get('/employee/:employeeId', protect, getAttendance);

export default router;
