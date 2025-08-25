// routes/auth-routes.js
// routes/auth-routes.js
import express from 'express';
import { bulkCreateEmployees, createEmployee, editEmployee, getAllEmployeesByCompanyId, getEmployee, updateBasicEmployeeInfo, uploadDocument, getAllEmployeesByCompanyIdPagination, getEmployeesByMonth, getEmployeeDocuments, getAllNewJoinerByCompanyId, makeUserActive, makeuserinactive, updateDocumentFields, makedocumentInValid, makedocumentValid } from '../controllers/employee-controller.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';


const router = express.Router();

router.post('/addEmployee', createEmployee);
router.get('/getall/:companyId', getAllEmployeesByCompanyId);
router.put('/edit/:userId', editEmployee);
router.post("/bulk-create", bulkCreateEmployees);
router.get('/getemployee/:employeeId', getEmployee);
router.put('/update/:employeeId', updateBasicEmployeeInfo);
router.put('/uploadDocument/:employeeId', protect, restrictTo("admin", "superadmin","newjoiner","employee"), uploadDocument);
router.get('/getEmployeeDocument/:employeeId', protect, restrictTo("admin", "superadmin","employee","newjoiner"), getEmployeeDocuments);
router.get('/getallpagination/:companyId', getAllEmployeesByCompanyIdPagination);
router.get('/monthWiseEmployees/:year/:month/:companyId', protect, restrictTo("superadmin", "admin"), getEmployeesByMonth);
router.get('/getallnewjoiners/:companyId', protect, restrictTo("superadmin", "admin"), getAllNewJoinerByCompanyId);
router.patch('/makeUserInActive/:employeeId', protect, restrictTo("superadmin", "admin"), makeuserinactive);
router.patch('/makeUserActive/:employeeId', protect, restrictTo("superadmin", "admin"), makeUserActive);
router.patch('/updateDocumentsFields/:employeeId', protect, restrictTo("superadmin", "admin"), updateDocumentFields);
router.patch('/makeDocumentInValid/:employeeId', protect, restrictTo("superadmin", "admin"), makedocumentInValid);
router.patch('/makeDocumentValid/:employeeId', protect, restrictTo("superadmin", "admin"), makedocumentValid);




export default router;
