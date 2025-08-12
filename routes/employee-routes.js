// routes/auth-routes.js
import express from 'express';
import { bulkCreateEmployees, createEmployee, editEmployee, getAllEmployeesByCompanyId, getEmployee, updateBasicEmployeeInfo, uploadDocument, getAllEmployeesByCompanyIdPagination } from '../controllers/employee-controller.js';
import { protect } from '../middleware/authMiddleware.js';


const router = express.Router();

router.post('/addEmployee', createEmployee);
router.get('/getall/:companyId', getAllEmployeesByCompanyId);
router.put('/edit/:userId', editEmployee);
router.post("/bulk-create", bulkCreateEmployees);
router.get('/getemployee/:employeeId', getEmployee);
router.put('/update/:employeeId', updateBasicEmployeeInfo);
router.put('/uploadDocument/:employeeId', uploadDocument);
router.get('/getallpagination/:companyId', getAllEmployeesByCompanyIdPagination);



export default router;
