import express from "express"
import { createDepartment, editDepartment, getDepartmentsByCompany } from "../controllers/department-controller.js";


const router = express.Router()

router.post("/create", createDepartment)
router.put("/edit/:departmentId", editDepartment) // Assuming editDepartment is also handled by createDepartment for simplicity
router.get("/getAll/:companyId", getDepartmentsByCompany) // Uncomment and implement if needed


export default router;
