import express from 'express';
import {
  applyLeave,
  getLeave,
  updateLeaveStatus,
  getEmployeeLeaves,
  getCompanyLeaves,
  updateLeave
} from '../controllers/leave-controller.js';


const router = express.Router();

// Apply for a leave (Employee only)
router.post('/apply', applyLeave);

// Get leave by ID (Manager/Admin/Employee)
router.get('/get/:leaveId', getLeave);

// Update leave status (Manager/Admin)
router.patch('/update/:id', updateLeaveStatus);

// Get all leaves for a specific employee (Admin/Manager or the employee themselves)
router.get('/employee/:employeeId',  getEmployeeLeaves);

// Get all leaves in the company (Admin/Manager)
router.get('/getCompany/:id',  getCompanyLeaves);

router.put('/leaves/:id', updateLeave);


export default router;
