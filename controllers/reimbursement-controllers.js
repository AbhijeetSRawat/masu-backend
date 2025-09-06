// controllers/reimbursement-controller.js
import Reimbursement from '../models/Reimbursement.js';
import uploadFileToCloudinary from '../utils/fileUploader.js';

export const createReimbursement = async (req, res) => {
  try {
    const { employeeId, companyId, category, amount, description, date } = req.body;
    const { recipt } = req.files;

    const documentUrl = await uploadFileToCloudinary(
      recipt,
      process.env.FOLDER_NAME
    )
    console.log(documentUrl)


    const reimbursement = await Reimbursement.create({
      employee: employeeId,
      company: companyId,
      category,
      amount,
      description,
      receiptUrl: documentUrl.result.secure_url,
      date
    });

    res.status(201).json({ success: true, data: reimbursement });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};


export const updateReimbursementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // approved / rejected

    if (!['approved', 'rejected', 'paid'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updated = await Reimbursement.findByIdAndUpdate(id, {
      status,
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    }, { new: true });

    if (!updated) {
      return res.status(404).json({ message: 'Reimbursement not found' });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const bulkUpdateReimbursementStatus = async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "Reimbursement IDs are required" });
    }

    if (!["approved", "rejected", "paid"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    // Update in bulk
    await Reimbursement.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status,
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      }
    );

    // Fetch updated records
    const updatedReimbursements = await Reimbursement.find({ _id: { $in: ids } });

    res.status(200).json({
      success: true,
      message: `Reimbursements updated to '${status}' successfully`,
      count: updatedReimbursements.length,
      data: updatedReimbursements,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getCompanyReimbursements = async (req, res) => {
  try {
    const { companyId } = req.params;

    const reimbursements = await Reimbursement.find({ company: companyId })
      .populate({
      path: 'employee',
      populate: {
        path: 'user', // this will populate employee's user
      }
    }).populate('category')// populate employee info
      .sort({ createdAt: -1 }).exec();

    res.status(200).json({ success: true, data: reimbursements });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


export const getEmployeeReimbursements = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const records = await Reimbursement.find({ employee: employeeId }).populate('category').populate('reviewedBy', 'paymentSlip.paidBy').sort({ createdAt: -1 }).exec();

    res.status(200).json({ success: true, data: records });
  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false, message: 'Server error' });
  }
};