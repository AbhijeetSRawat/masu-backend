// controllers/reimbursement-category-controller.js
import { populate } from 'dotenv';
import ReimbursementCategory from '../models/ReimbursementCategory.js';

export const createCategory = async (req, res) => {
  try {
    const { name, description, companyId,createdBy } = req.body;

    const category = await ReimbursementCategory.create({ name, description, company: companyId ,createdBy});

    res.status(201).json({ success: true, data: category });
  } catch (err) {
    console.log(err)
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getAllCategories = async (req, res) => {
  try {
    const { companyId } = req.params;

    const categories = await ReimbursementCategory.find({ company: companyId }).populate('createdBy','category').sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description ,createdBy} = req.body;

    const category = await ReimbursementCategory.findByIdAndUpdate(id, { name, description ,createdBy}, { new: true });

    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    res.status(200).json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// export const deleteCategory = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const category = await ReimbursementCategory.findByIdAndDelete(id);

//     if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

//     res.status(200).json({ success: true, message: 'Category deleted successfully' });
//   } catch (err) {
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };
