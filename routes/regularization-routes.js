import express from 'express';
import {
  getRegularizations,
  getRegularization,
  createRegularization,
  updateRegularization,
  deleteRegularization,
  bulkUpdateRegularizations
} from '../controllers/regularization-controller.js';
import { protect } from '../controllers/auth-controllers.js';
import { restrictTo } from '../middleware/authMiddleware.js';

// Middleware (if you have authentication/authorization)


const router = express.Router();

// ✅ GET all regularization requests (with optional filters)
router.get('/', protect, restrictTo("superadmin", "admin", "employee","subadmin"), getRegularizations);

// ✅ GET a single regularization request by ID
router.get('/:id', protect, restrictTo("superadmin", "admin", "employee","subadmin"), getRegularization);

// ✅ POST a new regularization request
router.post('/', protect, restrictTo("superadmin", "admin", "employee","subadmin"), createRegularization);

// ✅ PUT (update) a regularization request (e.g., approve/reject)
router.put('/:id', protect, restrictTo("superadmin", "admin", "employee","subadmin"), updateRegularization);

// ✅ DELETE a regularization request (if not approved)
router.delete('/:id', protect, restrictTo("superadmin", "admin", "employee","subadmin"), deleteRegularization);

router.patch('/bulkupdate', protect, restrictTo("superadmin", "admin","subadmin"), bulkUpdateRegularizations);

export default router;
