import express from "express";
import {
  getAttendances,
  getAttendance,
  createAttendance,
  updateAttendance,
  deleteAttendance,
} from "../controllers/attendance-controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all attendances (with filters via query params)
router.get("/",  getAttendances);

// Get a single attendance by ID
router.get("/:id", protect, getAttendance);

// Create a new attendance record
router.post("/", createAttendance);

// // Update an attendance record by ID
// router.put("/:id", protect, updateAttendance);

// // Delete an attendance record by ID
// router.delete("/:id", protect, deleteAttendance);

export default router;
