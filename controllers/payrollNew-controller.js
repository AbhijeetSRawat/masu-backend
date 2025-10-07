import asyncHandler from 'express-async-handler';
import { PayrollProcessing, PayrollBatch } from '../models/PayrollNew.js';
import { 
  getEmployeePayrollData, 
  calculateMonthlyEarnings, 
  calculateDeductions, 
  calculateNetSalary 
} from '../services/payrollCalculationService.js';
import { createAuditLog } from '../services/auditService.js';
import Employee from '../models/Employee.js';

// ================================
// @desc    Process payroll for single employee
// @route   POST /api/payroll/process
// @access  Private/Admin/HR
// ================================
const processPayroll = asyncHandler(async (req, res) => {
  const { employeeId, month, year, payDays, lopDays, adjustments } = req.body;

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    return res.status(404).json({
      success: false,
      message: 'Employee not found'
    });
  }

  const financialYear = `${year}-${year + 1}`;
  const { ctcAnnexure, flexiDeclaration } = await getEmployeePayrollData(
    employeeId, 
    financialYear, 
    employee.company
  );

  if (!ctcAnnexure) {
    return res.status(404).json({
      success: false,
      message: 'Active CTC annexure not found'
    });
  }

  // Check if payroll already processed
  const existingPayroll = await PayrollProcessing.findOne({
    employee: employeeId,
    'payrollPeriod.month': month,
    'payrollPeriod.year': year,
    company: employee.company
  });

  if (existingPayroll) {
    return res.status(400).json({
      success: false,
      message: `Payroll already processed for ${month}/${year}`
    });
  }

  // Calculate payroll
  const earnings = calculateMonthlyEarnings(ctcAnnexure, flexiDeclaration, payDays, lopDays);
  const deductions = calculateDeductions(earnings, employee.employeeType);

  // Apply adjustments (if any)
  if (adjustments) {
    Object.keys(adjustments.earnings || {}).forEach(key => {
      if (earnings[key] !== undefined) earnings[key] += adjustments.earnings[key];
    });
    Object.keys(adjustments.deductions || {}).forEach(key => {
      if (deductions[key] !== undefined) deductions[key] += adjustments.deductions[key];
    });

    // Recalculate totals
    earnings.totalEarnings = Object.values(earnings).reduce((sum, val) => sum + val, 0);
    deductions.totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);
  }

  const netSalary = calculateNetSalary(earnings, deductions);

  // Save payroll
  const payroll = new PayrollProcessing({
    company: employee.company,
    employee: employeeId,
    ctcAnnexure: ctcAnnexure._id,
    flexiDeclaration: flexiDeclaration?._id,
    payrollPeriod: { month, year, payDays, lopDays },
    earnings,
    deductions,
    netSalary,
    processedBy: req.user._id,
    processedAt: new Date(),
    status: 'processed'
  });

  const savedPayroll = await payroll.save();

  // Audit log
  await createAuditLog(req.user._id, req.user.company, 'Payroll Processed', {
    employee: employee.employeeId,
    period: `${month}/${year}`,
    netSalary
  });

  return res.status(201).json({
    success: true,
    message: '✅ Payroll processed successfully',
    data: {
      employee: employee.name,
      month,
      year,
      netSalary,
      payrollId: savedPayroll._id
    }
  });
});

// ================================
// @desc    Get payroll details for employee
// @route   GET /api/payroll/employee/:employeeId
// @access  Private/Admin/HR/Employee
// ================================
const getEmployeePayroll = asyncHandler(async (req, res) => {
  const { employeeId, companyId } = req.params;
  const { month, year } = req.query;

  let query = { employee: employeeId, company: companyId };

  if (month && year) {
    query['payrollPeriod.month'] = parseInt(month);
    query['payrollPeriod.year'] = parseInt(year);
  }

  const payroll = await PayrollProcessing.findOne(query)
    .populate({
      path: 'employee',
      populate: { path: 'user', select: 'email profile' }
    })
    .populate('processedBy', 'name')
    .populate('approvedBy', 'name')
    .sort({ 'payrollPeriod.year': -1, 'payrollPeriod.month': -1 });

  if (!payroll) {
    return res.status(404).json({
      success: false,
      message: 'Payroll record not found'
    });
  }

  // Authorization check
  if (req.user.role === 'Employee') {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee || employee._id.toString() !== employeeId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can view only your own payroll data'
      });
    }
  }

  return res.status(200).json({
    success: true,
    message: '✅ Payroll record fetched successfully',
    data: payroll
  });
});

// ================================
// @desc    Process payroll in bulk
// @route   POST /api/payroll/bulk
// @access  Private/Admin/HR
// ================================
const processBulkPayroll = asyncHandler(async (req, res) => {
  const { batchName, month, year, employees } = req.body;

  const batch = new PayrollBatch({
    company: req.user.company,
    batchName,
    payrollPeriod: { month, year },
    employees: employees.map(emp => ({
      employee: emp.employeeId,
      status: 'pending'
    })),
    processedBy: req.user._id,
    status: 'processing'
  });

  const savedBatch = await batch.save();

  // Process each employee in background
  processBatchInBackground(savedBatch._id, employees, month, year, req.user);

  return res.status(202).json({
    success: true,
    message: '🕒 Bulk payroll processing started in background',
    data: {
      batchId: savedBatch._id,
      batchName: savedBatch.batchName,
      totalEmployees: employees.length
    }
  });
});

// ================================
// @desc    Generate payroll report
// @route   GET /api/payroll/report
// @access  Private/Admin/HR
// ================================
const generatePayrollReport = asyncHandler(async (req, res) => {
  const { month, year, department, companyId } = req.query;

  let query = { 
    company: companyId,
    'payrollPeriod.month': parseInt(month),
    'payrollPeriod.year': parseInt(year),
    status: { $in: ['processed', 'paid'] }
  };

  if (department) {
    const employeesInDept = await Employee.find({ 
      department, 
      company: companyId 
    }).select('_id');
    query.employee = { $in: employeesInDept.map(emp => emp._id) };
  }

  const payrolls = await PayrollProcessing.find(query)
    .populate('employee', 'name employeeId department designation')
    .select('earnings deductions netSalary payrollPeriod')
    .lean();

  if (payrolls.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No payroll data found for the selected filters'
    });
  }

  const report = {
    period: `${month}/${year}`,
    totalEmployees: payrolls.length,
    summary: {
      totalEarnings: payrolls.reduce((sum, p) => sum + p.earnings.totalEarnings, 0),
      totalDeductions: payrolls.reduce((sum, p) => sum + p.deductions.totalDeductions, 0),
      totalNetSalary: payrolls.reduce((sum, p) => sum + p.netSalary, 0)
    },
    departmentBreakdown: payrolls.reduce((acc, payroll) => {
      const dept = payroll.employee.department;
      if (!acc[dept]) {
        acc[dept] = { employees: 0, totalSalary: 0 };
      }
      acc[dept].employees++;
      acc[dept].totalSalary += payroll.netSalary;
      return acc;
    }, {}),
    payrollDetails: payrolls
  };

  return res.status(200).json({
    success: true,
    message: '📊 Payroll report generated successfully',
    data: report
  });
});

// ================================
// Background Batch Payroll Processor
// ================================
const processBatchInBackground = async (batchId, employees, month, year, user) => {
  try {
    const batch = await PayrollBatch.findById(batchId);
    let totalEarnings = 0;
    let totalDeductions = 0;
    let totalNetSalary = 0;

    for (const emp of employees) {
      try {
        const { ctcAnnexure, flexiDeclaration } = await getEmployeePayrollData(
          emp.employeeId,
          `${year}-${year + 1}`,
          user.company
        );

        if (ctcAnnexure) {
          const earnings = calculateMonthlyEarnings(ctcAnnexure, flexiDeclaration, emp.payDays, emp.lopDays);
          const deductions = calculateDeductions(earnings, emp.employeeType);
          const netSalary = calculateNetSalary(earnings, deductions);

          const payroll = new PayrollProcessing({
            company: user.company,
            employee: emp.employeeId,
            ctcAnnexure: ctcAnnexure._id,
            flexiDeclaration: flexiDeclaration?._id,
            payrollPeriod: { month, year, payDays: emp.payDays, lopDays: emp.lopDays },
            earnings,
            deductions,
            netSalary,
            processedBy: user._id,
            processedAt: new Date(),
            status: 'processed'
          });

          const savedPayroll = await payroll.save();

          // Update batch
          const employeeIndex = batch.employees.findIndex(e => e.employee.toString() === emp.employeeId);
          if (employeeIndex !== -1) {
            batch.employees[employeeIndex].payroll = savedPayroll._id;
            batch.employees[employeeIndex].status = 'processed';
          }

          totalEarnings += earnings.totalEarnings;
          totalDeductions += deductions.totalDeductions;
          totalNetSalary += netSalary;
        }
      } catch (error) {
        console.error(`❌ Error processing payroll for employee ${emp.employeeId}:`, error);
      }
    }

    batch.totalEarnings = totalEarnings;
    batch.totalDeductions = totalDeductions;
    batch.totalNetSalary = totalNetSalary;
    batch.status = 'completed';
    batch.processedAt = new Date();
    await batch.save();

    console.log(`✅ Payroll batch ${batch.batchName} completed successfully`);
  } catch (error) {
    console.error('❌ Batch payroll processing error:', error);
    await PayrollBatch.findByIdAndUpdate(batchId, { status: 'cancelled' });
  }
};

export {
  processPayroll,
  getEmployeePayroll,
  processBulkPayroll,
  generatePayrollReport
};
