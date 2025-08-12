import express from 'express';
import { addCompanyPolicy, getCompanyPolicies, getPolicyById, updatePolicy } from '../controllers/policy-controllers.js';



const router = express.Router();
router.post('/add', addCompanyPolicy); // Add new policy
router.get('/company/:companyId', getCompanyPolicies); // Get all policies of a company
router.get('/:policyId', getPolicyById); // Get one policy
router.put('/update/:policyId', updatePolicy); // Update policy

export default router;
