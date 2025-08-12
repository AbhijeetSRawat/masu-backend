import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

export const comparePasswords = async (candidatePassword, userPassword) => {
  return await bcrypt.compare(candidatePassword, userPassword);
};

export const generateRandomPassword = () => {
  return crypto.randomBytes(2).toString('hex');
};

export const generateEmployeeId = async (count, companyId) => {
 
  return `${companyId}_${(count + 1).toString().padStart(4, '0')}`;
};

export const calculateLeaveDays = (startDate, endDate) => {
  const diffTime = Math.abs(new Date(endDate) - new Date(startDate));
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive of both dates
};

export const createPasswordResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  const passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return { resetToken, passwordResetToken, passwordResetExpires };
};

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendAdminCredentials = async (email, loginEmail, tempPassword, companyId) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "MASU Admin Account Credentials",
    text: `
🎉 Your admin account has been created!

🔐 Login Email: ${loginEmail}
🔑 Temporary Password: ${tempPassword}
🏢 Company ID: ${companyId}

Please login and change your password immediately.
    `.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Admin credentials sent to HR:", email);
  } catch (error) {
    console.error("Error sending admin credentials:", error);
  }
};

export const sendOtpEmail = async (email, subject) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "MASU Password Reset OTP",
    text: `
🔐 You requested to reset your password.

    ${subject}
    `.trim(),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("OTP sent to user:", email);
  } catch (error) {
    console.error("Error sending OTP email:", error);
  }
};
