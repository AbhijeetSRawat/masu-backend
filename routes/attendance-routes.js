import express from "express";
import {
  getAttendances,
  getAttendance,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getEmployeesUnderHRorManager,
  bulkCreateAttendance,
  getAttendanceByDate,
  bulkUpdateAttendance,
} from "../controllers/attendance-controller.js";
import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all attendances (with filters via query params)
router.get("/",  getAttendances);

// Get a single attendance by ID
router.get("/:id", protect, getAttendance);

// Create a new attendance record
router.post("/", createAttendance);

router.get('/employeeUnderHR/:userId', protect, getEmployeesUnderHRorManager);
router.post('/bulkattendance', protect, bulkCreateAttendance);
router.get('/getbydate/:userId', protect, getAttendanceByDate);

// Single Update (Only HR)
router.put("/attendance/:id",protect, restrictTo("superadmin","admin","hr","manager"), updateAttendance);


// Bulk Update (Only HR)
router.put("/bulkupdateattendance", protect, restrictTo("superadmin","admin","hr","manager"),bulkUpdateAttendance);

// // Delete an attendance record by ID
// router.delete("/:id", protect, deleteAttendance);

export default router;
