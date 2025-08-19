import LeavePolicy from '../models/LeavePolicy.js';

export const createLeavePolicy = async (req, res) => {
  try {
    const { company, yearStartMonth, weekOff, leaveTypes, holidays } = req.body;

    // Validate required fields
    if (!company) {
      throw new Error('Company is required');
    }

    // Check if policy already exists
    const exists = await LeavePolicy.findOne({ company });
    if (exists) {
      throw new Error('Policy already exists for this company');
    }

    // Validate leave types
    const shortCodes = new Set();
    for (const type of leaveTypes) {
      if (!type.name || !type.shortCode) {
        throw new Error('Leave type name and shortCode are required');
      }
      if (shortCodes.has(type.shortCode)) {
        throw new Error(`Duplicate shortCode: ${type.shortCode}`);
      }
      shortCodes.add(type.shortCode);
    }

    

    // Create the policy
    const policy = new LeavePolicy({
      company,
      yearStartMonth: yearStartMonth || 1,
      weekOff: weekOff || [0, 6], // Default to Sunday and Saturday
      leaveTypes,
      holidays: holidays || []
    });

    await policy.save();

    res.status(201).json({ 
      success: true, 
      message: 'Leave policy created successfully',
      policy 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const updateLeavePolicy = async (req, res) => {
  try {
    const { policyId } = req.params;
    const { yearStartMonth, weekOff, holidays } = req.body;

    const updates = {};
    if (yearStartMonth !== undefined) updates.yearStartMonth = yearStartMonth;
    if (weekOff !== undefined) updates.weekOff = weekOff;
    if (holidays !== undefined) updates.holidays = holidays;

    const updated = await LeavePolicy.findByIdAndUpdate(
      policyId,
      updates,
      { new: true }
    );

    if (!updated) {
      throw new Error('Policy not found');
    }

    res.json({ 
      success: true, 
      message: 'Policy updated successfully',
      policy: updated 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const addLeaveType = async (req, res) => {
  try {
    const { policyId } = req.params;
    const newType = req.body;

    // Validate new type
    if (!newType.name || !newType.shortCode) {
      throw new Error('Leave type name and shortCode are required');
    }

    const policy = await LeavePolicy.findById(policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    // Check for duplicate shortCode
    if (policy.leaveTypes.some(t => t.shortCode === newType.shortCode)) {
      throw new Error(`Leave type with shortCode ${newType.shortCode} already exists`);
    }

    if(newType.maxInstancesPerYear && newType.maxInstancesPerYear < 1) {
      throw new Error('Invalid maxInstancesPerYear. It must be at least 1.');
    }
    if(newType.maxPerRequest && newType.maxPerRequest < 1) {
      throw new Error('Invalid maxPerRequest. It must be at least 1.');
    }
    if(newType.maxPerRequest> newType.maxInstancesPerYear) {
      throw new Error('Invalid maxPerRequest. It must be less than or equal to maxInstancesPerYear.');
    }

    policy.leaveTypes.push(newType);
    await policy.save();

    res.json({ 
      success: true, 
      message: 'Leave type added successfully',
      policy 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const updateLeaveType = async (req, res) => {
  try {
    const { policyId, typeId } = req.params;
    const updateData = req.body;

    const policy = await LeavePolicy.findById(policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    const typeIndex = policy.leaveTypes.findIndex(t => t._id.toString() === typeId);
    if (typeIndex === -1) {
      throw new Error('Leave type not found');
    }

    // Preserve the shortCode if not provided
    if (!updateData.shortCode) {
      updateData.shortCode = policy.leaveTypes[typeIndex].shortCode;
    }

    // Check for duplicate shortCode
    if (updateData.shortCode !== policy.leaveTypes[typeIndex].shortCode) {
      if (policy.leaveTypes.some((t, i) => 
        i !== typeIndex && t.shortCode === updateData.shortCode
      )) {
        throw new Error(`Leave type with shortCode ${updateData.shortCode} already exists`);
      }
    }

    // Update the leave type
    policy.leaveTypes[typeIndex] = {
      ...policy.leaveTypes[typeIndex].toObject(),
      ...updateData,
      _id: policy.leaveTypes[typeIndex]._id
    };

    await policy.save();

    res.json({ 
      success: true, 
      message: 'Leave type updated successfully',
      policy 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const toggleLeaveTypeStatus = async (req, res) => {
  try {
    const { policyId, typeId } = req.params;

    const policy = await LeavePolicy.findById(policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    const typeIndex = policy.leaveTypes.findIndex(t => t._id.toString() === typeId);
    if (typeIndex === -1) {
      throw new Error('Leave type not found');
    }

    // Toggle the isActive status
    policy.leaveTypes[typeIndex].isActive = !policy.leaveTypes[typeIndex].isActive;
    await policy.save();

    res.json({ 
      success: true, 
      message: `Leave type ${policy.leaveTypes[typeIndex].isActive ? 'activated' : 'deactivated'}`,
      policy 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

export const getLeavePolicy = async (req, res) => {
  try {
    const { companyId } = req.params;

    const policy = await LeavePolicy.findOne({ company: companyId })
      .populate('company', 'name industry');

    if (!policy) {
      throw new Error('Leave policy not found');
    }

    res.json({ 
      success: true, 
      policy 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};