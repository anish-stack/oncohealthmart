const { v4: uuidv4 } = require("uuid");
const pool = require("../Database/db");
const sendTemplateMessage = require("../utils/sendTemplateMessage");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = (file) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: "image" },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        stream.end(file.buffer);
    });
};

exports.upload_prescriptions = async (req, res) => {
    try {
        let userIdComes;
        let user;


        if (Array.isArray(req.user.id)) {
            userIdComes = req.user.id[0]?.customer_id;

        } else {
            userIdComes = req.user.id?.customer_id;

        }

        if (!userIdComes) {
            return res.status(401).json({ message: 'Please login to access this resource' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: "No files uploaded" });
        }

        if (!req.files.every(file => file.buffer)) {
            return res.status(400).json({ success: false, message: "Invalid file format" });
        }

        const prescriptionUUID = uuidv4();
        const userId = userIdComes || null;
        const prescriptionStatus = "pending";
        const prescriptionORD = `PRC-${Date.now()}`
        const currentDate = new Date();

        const findUser = `SELECT * FROM cp_customer WHERE customer_id = ${userId}`;
        const [userExists] = await pool.query(findUser);
        user = userExists[0];
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const imageUrls = await Promise.all(req.files.slice(0, 5).map(uploadToCloudinary));

        const query = `
            INSERT INTO cp_app_prescription 
            (image_1, image_2, image_3, image_4, image_5, user_id, uuid, prescription_status, genreate_presc_order_id, date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            imageUrls[0] || null,
            imageUrls[1] || null,
            imageUrls[2] || null,
            imageUrls[3] || null,
            imageUrls[4] || null,
            userId,
            prescriptionUUID,
            prescriptionStatus,
            prescriptionORD,
            currentDate,
        ];

        await pool.query(query, values);

        const data = {
            mobile: user?.mobile,
            templatename: 'prescription_uploaded'
        }

        sendTemplateMessage(data)
        return res.status(200).json({
            success: true,
            message: "Files uploaded and saved successfully!",
            uuid: prescriptionORD,
            files: imageUrls,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Upload failed",
            error: error.message,
        });
    }
};



exports.get_my_uploaded_presc = async (req, res) => {
    try {
        let userIdComes;
        if (Array.isArray(req.user.id)) {
            userIdComes = req.user.id[0]?.customer_id;
        } else {
            userIdComes = req.user.id?.customer_id;
        }

        if (!userIdComes) {
            return res.status(401).json({ message: 'Please login to access this resource' });
        }

        const presc = `SELECT * FROM cp_app_prescription WHERE user_id = '${userIdComes}'`;

        const [prescriptions] = await pool.query(presc);

        if (prescriptions.length === 0) {
            return res.status(404).json({ message: 'No prescriptions found' });
        }

        res.json({ success: true, message: 'Prescriptions fetched successfully', data: prescriptions });

    } catch (error) {
        console.error("Error fetching prescriptions: ", error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


// Get All Prescriptions
exports.getAllPrescriptions = async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM cp_app_prescription");
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        console.error("Error fetching all prescriptions:", error);
        res.status(500).json({ success: false, message: "Failed to retrieve prescriptions", error: error.message });
    }
};

// Get Single Prescription by ID
exports.getPrescriptionById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "Invalid prescription ID" });
        }

        const [rows] = await pool.query("SELECT * FROM cp_app_prescription WHERE `S.No` = ?", [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Prescription not found" });
        }

        res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        console.error("Error fetching prescription by ID:", error);
        res.status(500).json({ success: false, message: "Failed to retrieve prescription", error: error.message });
    }
};

// Delete Prescription by ID
exports.deletePrescriptionById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        if (isNaN(id) || id <= 0) {
            return res.status(400).json({ success: false, message: "Invalid prescription ID" });
        }

        const [result] = await pool.query("DELETE FROM cp_app_prescription WHERE `S.No` = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Prescription not found" });
        }

        res.status(200).json({ success: true, message: "Prescription deleted successfully" });
    } catch (error) {
        console.error("Error deleting prescription:", error);
        res.status(500).json({ success: false, message: "Failed to delete prescription", error: error.message });
    }
};

