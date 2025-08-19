// routes/leavePolicyRoutes.js
import express from 'express';
import {
  createLeavePolicy,
  updateLeavePolicy,
  addLeaveType,
  updateLeaveType,

  getLeavePolicy
} from '../controllers/leavepolicy-controller.js';

const router = express.Router();

// Create a new policy
router.post('/', createLeavePolicy);

// Update policy details
router.put('/:policyId', updateLeavePolicy);

// Add new leave type
router.post('/:policyId/type', addLeaveType);

// Update leave type
router.put('/:policyId/type/:typeId', updateLeaveType);



// Get policy by company
router.get('/company/:companyId', getLeavePolicy);

export default router;
