// routes/auth-routes.js
import express from 'express';
import { forgotPassword, getMe, login, register, resetPassword } from '../controllers/auth-controllers.js';

const router = express.Router();

router.post('/create', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword); // Assuming this is for resetting password with OTP
router.get('/me', getMe)
export default router;
