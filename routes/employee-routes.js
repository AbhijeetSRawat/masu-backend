// routes/auth-routes.js
// routes/auth-routes.js
import express from 'express';
import { bulkCreateEmployees, createEmployee, editEmployee, getAllEmployeesByCompanyId, getEmployee, updateBasicEmployeeInfo, uploadDocument, getAllEmployeesByCompanyIdPagination, getEmployeesByMonth } from '../controllers/employee-controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';


const router = express.Router();

router.post('/addEmployee', createEmployee);
router.get('/getall/:companyId', getAllEmployeesByCompanyId);
router.put('/edit/:userId', editEmployee);
router.post("/bulk-create", bulkCreateEmployees);
router.get('/getemployee/:employeeId', getEmployee);
router.put('/update/:employeeId', updateBasicEmployeeInfo);
router.put('/uploadDocument/:employeeId', uploadDocument);
router.get('/getallpagination/:companyId', getAllEmployeesByCompanyIdPagination);
router.get('/monthWiseEmployees/:year/:month/:companyId', protect, restrictTo("superadmin", "admin"), getEmployeesByMonth);



export default router;
