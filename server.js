// ------------------- Import Core Dependencies -------------------
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import fileUpload from 'express-fileupload';

// ------------------- Load Env Variables -------------------
dotenv.config();

// ------------------- Import Custom Modules -------------------
import connectDB from './config/db.js';
import cloudinaryConnect from './config/cloudinary.js';

// ------------------- Import Routes -------------------
// Auth & Access
import authRoutes from './routes/auth-routes.js';
import subAdminRoutes from './routes/subAdmin-routes.js';

// Company & Structure
import companyRoutes from './routes/company-routes.js';
import departmentRoutes from './routes/department-routes.js';
import shiftRoutes from './routes/shift-routes.js';
import tableStructureRoutes from './routes/table-structure-routes.js';

// Employee
import employeeRoutes from './routes/employee-routes.js';
import resignationRoutes from './routes/resignation-routes.js';
import regularizationRoutes from './routes/regularization-routes.js';

// Leave & Policy
import leaveRoutes from './routes/leave-routes.js';
import leavePolicyRoutes from './routes/leavepolicy-route.js';
import policyRoutes from './routes/policy-routes.js';

// Attendance
import attendanceRoutes from './routes/attendance-routes.js';

// Reimbursements
import reimbursementRoutes from './routes/reimbursement-routes.js';
import reimbursementCategoryRoutes from './routes/reimbursement-category-routes.js';

//PayrollRoutes
import payrollRoutes from './routes/payrollRoutes.js';

// ------------------- Initialize App -------------------
const app = express();
const PORT = process.env.PORT || 4000;

// ------------------- Connect to DB -------------------
connectDB();

// ------------------- Middleware -------------------
app.use(express.json());                    // Parse JSON request bodies
app.use(cookieParser());                    // Parse cookies
app.use(cors({
  origin: ['http://localhost:5173', 'https://masu-frontend.vercel.app'],
  credentials: true,
}));                                        // Handle CORS for allowed origins
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
}));                                        // File upload middleware

cloudinaryConnect();                        // Connect to Cloudinary

// ------------------- Health Check Route -------------------
app.get('/', (req, res) => {
  res.send('✅ MASU Server is running!');
});

// ------------------- API Routes -------------------
// Auth
app.use('/api/auth', authRoutes);
app.use('/api/sub-admin', subAdminRoutes);

// Company Structure
app.use('/api/company', companyRoutes);
app.use('/api/department', departmentRoutes);
app.use('/api/shift', shiftRoutes);
app.use('/api/table-structures', tableStructureRoutes);

// Employees
app.use('/api/employee', employeeRoutes);
app.use('/api/resignation', resignationRoutes);
 app.use('/api/regularization', regularizationRoutes);

// Leave & Policy
app.use('/api/leave', leaveRoutes);
app.use('/api/leave-policy', leavePolicyRoutes);
app.use('/api/policies', policyRoutes);

// Attendance
app.use('/api/attendance', attendanceRoutes);

// Reimbursements
app.use('/api/reimbursements', reimbursementRoutes);
app.use('/api/reimbursement-categories', reimbursementCategoryRoutes);

// Payroll Routes
app.use('/api/payroll',payrollRoutes);

// ------------------- Start Server -------------------
app.listen(PORT, () => {
  console.log(`🚀 Server is running at: http://localhost:${PORT}`);
});
