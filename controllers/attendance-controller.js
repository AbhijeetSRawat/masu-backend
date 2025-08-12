// controllers/attendance-controller.js
import Attendance from '../models/Attendance.js';

export const markAttendance = async (req, res, next) => {
  try {
    const { employeeId, companyId, date, inTime, outTime, status } = req.body;

    const existing = await Attendance.findOne({ employee: employeeId, date });

    if (existing) {
      return res.status(400).json({ message: 'Attendance already marked for this date' });
    }

    const attendance = await Attendance.create({
      employee: employeeId,
      company: companyId,
      date,
      inTime,
      outTime,
      status,
      markedBy: req.user.id
    });

    res.status(201).json({
      status: 'success',
      data: { attendance }
    });
  } catch (err) {
    next(err);
  }
};


export const updateAttendanceTime = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { inTime, outTime } = req.body;

    const updated = await Attendance.findByIdAndUpdate(
      id,
      { inTime, outTime },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Attendance not found' });
    }

    res.status(200).json({ status: 'success', data: { attendance: updated } });
  } catch (err) {
    next(err);
  }
};


export const getEmployeeAttendance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    const records = await Attendance.find({ employee: employeeId })
      .sort({ date: -1 });

    res.status(200).json({
      status: 'success',
      results: records.length,
      data: { attendance: records }
    });
  } catch (err) {
    next(err);
  }
};


export const getCompanyAttendance = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const attendanceRecords = await Attendance.find({ company: companyId })
      .populate('employee', 'name email') // populate employee info
      .sort({ date: -1 }); // most recent first

    res.status(200).json({
      status: 'success',
      results: attendanceRecords.length,
      data: { attendance: attendanceRecords }
    });
  } catch (err) {
    next(err);
  }
};