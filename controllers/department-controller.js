import Department from '../models/Department.js';
import Company from '../models/Company.js';
import Employee from '../models/Employee.js';

// CREATE DEPARTMENT
export const createDepartment = async (req, res) => {
  try {
    const { name, companyId, description, manager } = req.body;

    // Validate company
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Check if department already exists in this company
    const existing = await Department.findOne({ name, company: companyId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Department already exists in this company' });
    }

    const department = new Department({
      name,
      company: companyId,
      description,
      manager: manager || null
    });



    await department.save();
    
     await Employee.findByIdAndUpdate(manager, { 'employmentDetails.department': department._id });
    return res.status(201).json({ success: true, message: 'Department created', data: department });

  } catch (error) {
    console.error('Create Department Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};



export const editDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { name, description, manager } = req.body;

    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ success: false, message: "Department not found" });
    }

    const oldManagerId = department.manager?.toString();

    // If manager is changing
    if (manager && manager !== oldManagerId) {
      // Check if new manager was already assigned to some department
      const newManagerDoc = await Employee.findById(manager);
      const previousDeptId = newManagerDoc?.employmentDetails?.department;

      if (previousDeptId) {
        // Remove manager from that previous department
        await Department.findByIdAndUpdate(previousDeptId, { $unset: { manager: "" } });
        // Remove department from manager's employmentDetails
        await Employee.findByIdAndUpdate(manager, { $unset: { "employmentDetails.department": "" } });
      }

      // Remove current manager from this department
      if (oldManagerId) {
        await Employee.findByIdAndUpdate(oldManagerId, { $unset: { "employmentDetails.department": "" } });
      }

      // Assign this department to new manager
      await Employee.findByIdAndUpdate(manager, {
        "employmentDetails.department": department._id,
      });
      department.manager = manager;
    }

    // Update name/description
    if (name) department.name = name;
    if (description) department.description = description;

    await department.save();

    return res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    console.error("Edit Department Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};



// GET ALL DEPARTMENTS FOR A COMPANY
export const getDepartmentsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const departments = await Department.find({ company: companyId }).populate({
      path: 'manager',
      populate: {
        path: 'user', // this will populate employee's user
      }
    });

    return res.status(200).json({ success: true, data: departments });
  } catch (error) {
    console.error('Get Departments Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
