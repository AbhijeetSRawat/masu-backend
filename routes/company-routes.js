import express from "express"
import { downloadCompanyData, getAllCompanies, getCompanyDetails, registerCompany, updateCompanyDetails, updateCompanyPermissions } from "../controllers/company-controllers.js"
import { addHrEmployee,   getAllHrOrManagers,   updateHrEmployee } from "../controllers/employee-controller.js"

const router = express.Router()

router.post("/create", registerCompany)
router.get("/getAllCompanies", getAllCompanies)
router.post("/updatePermissions", updateCompanyPermissions)
router.get("/getCompanyDetails/:companyId", getCompanyDetails) // Assuming this is to get company details by companyId
router.post("/updateCompanyDetails/:companyId", updateCompanyDetails)



router.post("/addHR", addHrEmployee)
router.put("/editHR/:hrEmployeeId", updateHrEmployee)
router.get("/getManager/:companyId", getAllHrOrManagers)


router.get('/:companyId', downloadCompanyData);

export default router;
