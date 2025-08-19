
import Company from "../models/Company.js"
import User from '../models/User.js';
import { generateRandomPassword, sendAdminCredentials} from "../utils/helper.js"
import bcrypt from "bcryptjs"

import Counter from '../models/Counter.js';
import uploadFileToCloudinary from "../utils/fileUploader.js";
const getNextCompanyId = async () => {
  const result = await Counter.findOneAndUpdate(
    { _id: 'companyId' },
    { $inc: { sequence_value: 1 } },
    { new: true, upsert: true }
  );

  return result.sequence_value.toString().padStart(4, '0');
};


export const registerCompany = async (req, res) => {
  try {
    const {
      name, email, registrationNumber, website,
      contactEmail, contactPhone,
      street, city, state, pincode,
      gstNumber, panNumber, tanNumber,
      accountNumber, ifscCode, accountHolderName,
      hrName, hrEmail, hrDesignation,hrPhone,
      customFields,
    } = req.body;

    const {thumbnail} = req.files;

    let parsedCustomFields = [];

try {
  parsedCustomFields = typeof req.body.customFields === "string"
    ? JSON.parse(req.body.customFields)
    : req.body.customFields;
} catch (error) {
  console.error("❌ Error parsing customFields:", error);
  return res.status(400).json({
    success: false,
    message: "Invalid customFields format",
  });
}

    const documentUrl = await uploadFileToCloudinary(
          thumbnail,
          process.env.FOLDER_NAME
        )
        console.log(documentUrl)

     const newCompanyId = await getNextCompanyId();

    // 0. Check if company already exists by email or registration number
    const existingCompany = await Company.findOne({
      $or: [
        { email: email },
        { registrationNumber: registrationNumber }
      ]

    });

    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: "Company already exists with the provided email or registration number."
      });
    }
    const permissions = req.body.permissions || [];
    // 1. Create Company
   const company = new Company({
       name,
      email,
      registrationNumber,
      website,
      contactEmail,
      contactPhone,
      thumbnail:documentUrl.result.secure_url,
      address: { street, city, state, pincode },
      companyId: newCompanyId,
      taxDetails: {
        gstNumber,
        panNumber,
        tanNumber
      },

      bankDetails: {
        accountNumber,
        ifscCode,
        accountHolderName
      },

      hrDetails: {
        name: hrName,
        email: hrEmail,
        phone: hrPhone,
        designation: hrDesignation
      },

   
  customFields: parsedCustomFields,


    });

    await company.save();

    // 2. Check if admin email is already taken
    const existingAdmin = await User.findOne({ email: contactEmail });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin user with this contact email already exists."
      });
    }

    // 3. Create Admin User
    const plainPassword =  generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const adminEmail = `${name.replace(/\s+/g, '').toLowerCase()}${randomSuffix}@masu.com`;

    const adminUser = new User({
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      companyId: company._id,
      firstTimeLogin: true,
      profile:{}// to be configured by superadmin
    });

    await adminUser.save();

    // 4. Send Email
     await sendAdminCredentials(contactEmail, adminEmail, plainPassword, company.companyId);

    return res.status(201).json({
      success: true,
      message: "Company registered successfully. Admin credentials sent to email.",
      companyId: company.companyId,
      adminEmail: adminEmail,
      password: plainPassword,
    });

  } catch (error) {
    console.error("Register Company Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getCompanyDetails = async (req, res) => {
  try {
    const {companyId} = req.params;

    // 0. Validate companyId
    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company ID is required" });
    }

    // 1. Fetch company details
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    return res.status(200).json({
      success: true,
      data: company,
    });

  } catch (error) {
    console.error("Get Company Details Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
}


export const getAllCompanies = async (req, res) => {
  try {
    // 1. Fetch all companies
    const companies = await Company.find({});

    // 2. Merge each company with its admin user
    const mergedData = await Promise.all(
      companies.map(async (company) => {
        const adminUser = await User.findOne({ companyId: company._id, role: 'admin' }).lean();
        return {
          ...company.toObject(),
          adminUser: adminUser || null, // if no admin found
        };
      })
    );

    // 3. Send merged data
    return res.status(200).json({
      success: true,
      data: mergedData,
    });

  } catch (error) {
    console.error("Get All Companies Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


export const updateCompanyPermissions = async (req, res) => {
  try {
    const { companyId, permissions } = req.body;

    if (!companyId || !Array.isArray(permissions)) {
      return res.status(400).json({ message: 'Company ID and permissions (as array) are required.' });
    }

    // Find and update company permissions
    const company = await Company.findOneAndUpdate(
      { companyId: companyId },
      { $set: { permissions } },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({ message: 'Company not found.' });
    }

    res.status(200).json({
      message: 'Permissions updated successfully.',
      companyId: company._id,
      updatedPermissions: company.permissions
    });

  } catch (error) {
    console.error('Error in updateCompanyPermissions:', error);
    res.status(500).json({ message: 'Failed to update permissions.', error: error.message });
  }
};

export const updateCompanyDetails = async (req, res) => {
  try {
    const { companyId } = req.params;
   
    // 0. Check if company exists
    const company = await Company.findOne({_id: companyId });
  if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found with the provided ID.",
      });
    }

    
    // 1. Update allowed fields from req.body
    const {
      name, email, registrationNumber, website,
      contactEmail, contactPhone,
      street, city, state, pincode,
      gstNumber, panNumber, tanNumber,
      accountNumber, ifscCode, accountHolderName,
      hrName, hrEmail, hrDesignation, hrPhone,
      customFields,
    
    } = req.body;

    
    let thumbnail;
   let documentUrl = null;

if (req.files && req.files.thumbnail) {

  const {thumbnail} = req.files;

  try {
    documentUrl = await uploadFileToCloudinary(
      req.files.thumbnail,
      process.env.FOLDER_NAME
    );
  } catch (uploadError) {
    return res.status(500).json({
      success: false,
      message: "Error uploading thumbnail.",
    });
  }
}



        let parsedFields = [];
try {
  parsedFields = typeof customFields === "string"
    ? JSON.parse(customFields)
    : customFields;
} catch (err) {
  return res.status(400).json({ success: false, message: "Invalid customFields format" });
}

    // 2. Apply updates only if values are provided
    if (name) company.name = name;
    if (email) company.email = email;
    if (registrationNumber) company.registrationNumber = registrationNumber;
    if (website) company.website = website;
    if (contactEmail) company.contactEmail = contactEmail;
    if (contactPhone) company.contactPhone = contactPhone;
   

    if (street) company.address.street = street;
    if (city) company.address.city = city;
    if (state) company.address.state = state;
    if (pincode) company.address.pincode = pincode;

    if (gstNumber) company.taxDetails.gstNumber = gstNumber;
    if (panNumber) company.taxDetails.panNumber = panNumber;
    if (tanNumber) company.taxDetails.tanNumber = tanNumber;

    if (accountNumber) company.bankDetails.accountNumber = accountNumber;
    if (ifscCode) company.bankDetails.ifscCode = ifscCode;
    if (accountHolderName) company.bankDetails.accountHolderName = accountHolderName;

    if (hrName) company.hrDetails.name = hrName;
    if (hrEmail) company.hrDetails.email = hrEmail;
    if (hrPhone) company.hrDetails.phone = hrPhone;
    if (hrDesignation) company.hrDetails.designation = hrDesignation;

    if (parsedFields) company.customFields = parsedFields;

  

    if (documentUrl?.result?.secure_url) {
  company.thumbnail = documentUrl.result.secure_url;
}

    // 3. Save updated company
    await company.save();

    return res.status(200).json({
      success: true,
      message: "Company details updated successfully.",
      data: company
    });

  } catch (error) {
    console.error("Update Company Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
 



