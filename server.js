// server.js or index.js
import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/auth-routes.js';
import shiftRoutes from './routes/shift-routes.js';
import companyRoutes from './routes/company-routes.js';
import departmentRoutes from './routes/department-routes.js';
import employeeRoutes from './routes/employee-routes.js'; // Assuming you have an employeeRoutes file
import policyRoutes from './routes/policy-routes.js';
import leaveRoutes from './routes/leave-routes.js'; // Assuming you have a leaveRoutes file
import attendanceRoutes from './routes/attendance-routes.js';
import reimbursementRoutes from './routes/reimbursement-routes.js';
import fileUpload from 'express-fileupload';
import cloudinaryConnect from './config/cloudinary.js';
import reimbursementCategoryRoutes from './routes/reimbursement-category-routes.js';
import tableStructureRoutes from './routes/table-structure-routes.js';
 import leavePolicyRoutes  from './routes/leavepolicy-route.js'
import cookieParser from 'cookie-parser';




import cors from "cors";



dotenv.config(); // Load environment variables from .env

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
connectDB(); // Connect to database

app.use(cookieParser()); // For parsing cookies

// Allow multiple origins
const allowedOrigins = ['http://localhost:5173','https://masu-frontend.vercel.app']

app.use(cors({origin: allowedOrigins, credentials: true}));
//file-upload
app.use(
	fileUpload({
		useTempFiles: true,
		tempFileDir: "/tmp/",
	})
);




cloudinaryConnect();

// Sample route
app.get('/', (req, res) => {
  res.send('Hello from the server!');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/shift', shiftRoutes);
app.use('/api/department', departmentRoutes); // Assuming you have a departmentRoutes file
app.use('/api/attendance', attendanceRoutes);
app.use('/api/employee', employeeRoutes); // Assuming you have an employeeRoutes file
app.use('/api/policies', policyRoutes);
app.use('/api/leave', leaveRoutes); // Assuming you have a leaveRoutes file
app.use('/api/reimbursements', reimbursementRoutes);
app.use('/api/reimbursement-categories', reimbursementCategoryRoutes);
app.use('/api/table-structures', tableStructureRoutes);
app.use('/api/leave-policy', leavePolicyRoutes); // Importing leave policy routes

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
