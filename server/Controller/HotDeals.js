const { v4: uuidv4 } = require("uuid");
const pool = require("../Database/db");
const cloudinary = require("cloudinary").v2;
const sharp = require("sharp");

const MAX_BYTES_ALLOWED = 500000; // 500 KB

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.CreateHotDeals = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Image is required." });
        }

        const { title, description, bgColor, textColor, active_status, position } = req.body;

        const file = req.file;
        const validImageTypes = ["image/png", "image/jpeg", "image/jpg"];

        const emptyFields = [];
        if (!title) emptyFields.push("Title");
        if (!description) emptyFields.push("Description");
        if (!bgColor) emptyFields.push("Background Color");
        if (!textColor) emptyFields.push("Text Color");

        if (emptyFields.length > 0) {
            return res.status(400).json({ message: `${emptyFields.join(", ")} is required.` });
        }

        if (!validImageTypes.includes(file.mimetype)) {
            return res.status(400).json({ message: "Invalid file format. Only PNG, JPEG, JPG are accepted." });
        }

        // Sanitize and process image
        const sanitizedImageBuffer = await sharp(file.buffer)
            .resize(800, 600, { fit: "inside" })
            .toFormat("jpeg")
            .jpeg({ quality: 80 })
            .removeAlpha()
            .toBuffer();

        if (sanitizedImageBuffer.length > MAX_BYTES_ALLOWED) {
            return res.status(400).json({ message: "Image size exceeds 500 KB after processing." });
        }

        // Upload to Cloudinary
        cloudinary.uploader.upload_stream(
            { folder: "hot_deals" },
            async (error, result) => {
                if (error) {
                    return res.status(500).json({ message: "Cloudinary upload failed.", error: error.message });
                }

                const id = uuidv4();
                const imageUrl = result.secure_url;
                const filePublicId = result.public_id;
                const statusBool = active_status === "true" ? true : false;

                try {
                    // Insert into PostgreSQL database
                    const insertQuery = `
                        INSERT INTO cp_deals (title, description, image,public_id, bgColor, textColor, active_status, position) 
                        VALUES (?, ?, ?,?, ?, ?, ?, ?)
                    `;
                    const values = [title, description, imageUrl, filePublicId, bgColor, textColor, statusBool, position];

                    await pool.query(insertQuery, values);

                    return res.status(200).json({
                        success: true,
                
                        message: "Hot Deals created successfully",
                        imageUrl: imageUrl,
                    });
                } catch (dbError) {
                    console.error("Database Insert Error:", dbError);
                    return res.status(500).json({ message: "Failed to insert into database", error: dbError.message });
                }
            }
        ).end(sanitizedImageBuffer);


    } catch (error) {
        console.error("CreateHotDeals Error:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message,
        });
    }
};

exports.GetAllDeals = async (req, res) => {
    try {
        const query = req.query.active;
        let getQuery;

        if (query === "1" || query === "true") {
            getQuery = `SELECT * FROM cp_deals WHERE active_status = 1`;
        } else {
            getQuery = `SELECT * FROM cp_deals`;
        }

        const [deals] = await pool.query(getQuery);
        
        return res.status(200).json({ message: "Deals fetched successfully", deals });
    } catch (error) {
        console.error("GetAllDeals Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



exports.DeleteDeal = async (req, res) => {
    try {
        const { id } = req.query;

        const [existingDeal] = await pool.query(`SELECT * FROM cp_deals WHERE id = ?`, [id]);

        if (existingDeal.length === 0) {
            return res.status(404).json({ message: "Deal not found." });
        }




        await cloudinary.uploader.destroy(existingDeal[0]?.public_id, async (error, result) => {
            if (error) {
                return res.status(500).json({ message: "Failed to delete image from Cloudinary.", error });
            }


            const deleteQuery = `DELETE FROM cp_deals WHERE id = ?`;
            await pool.query(deleteQuery, [id]);

            return res.status(200).json({
                success: true,
                message: "Deal deleted successfully."
            });
        });
    } catch (error) {
        console.error("DeleteDeal Error:", error);
        return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
    }
};


exports.UpdateDeal = async (req, res) => {
    try {
        const { id, title, description, bgColor, textColor, active_status, position } = req.body;

        if (!id) {
            return res.status(400).json({ message: "Deal ID is required." });
        }


        const [existingDeal] = await pool.query(`SELECT * FROM cp_deals WHERE id = ?`, [id]);

        if (existingDeal.length === 0) {
            return res.status(404).json({ message: "Deal not found." });
        }

        let imageUrl = existingDeal[0].image;
        let public_id = existingDeal[0].public_id;

        if (req.file) {
            // Remove old image from Cloudinary if exists
            if (public_id) {
                await cloudinary.uploader.destroy(public_id);
            }

            // Optimize image using Sharp
            const sanitizedImageBuffer = await sharp(req.file.buffer)
                .resize(800, 600, { fit: "inside" })
                .toFormat("jpeg")
                .jpeg({ quality: 80 })
                .removeAlpha()
                .toBuffer();

            if (sanitizedImageBuffer.length > MAX_BYTES_ALLOWED) {
                return res.status(400).json({ message: "Image size exceeds 500 KB after processing." });
            }

            // Upload to Cloudinary
            const uploadResponse = await new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: "hot_deals" },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );
                uploadStream.end(sanitizedImageBuffer);
            });

            imageUrl = uploadResponse.secure_url;
            public_id = uploadResponse.public_id;
        }

        // Prepare update query dynamically (only update provided fields)
        let updateQuery = "UPDATE cp_deals SET ";
        const updateValues = [];
        const fieldsToUpdate = [];

        if (title) {
            fieldsToUpdate.push("title = ?");
            updateValues.push(title);
        }
        if (description) {
            fieldsToUpdate.push("description = ?");
            updateValues.push(description);
        }
        if (imageUrl) {
            fieldsToUpdate.push("image = ?");
            updateValues.push(imageUrl);
        }
        if (public_id) {
            fieldsToUpdate.push("public_id = ?");
            updateValues.push(public_id);
        }
        if (bgColor) {
            fieldsToUpdate.push("bgColor = ?");
            updateValues.push(bgColor);
        }
        if (textColor) {
            fieldsToUpdate.push("textColor = ?");
            updateValues.push(textColor);
        }
        if (active_status !== undefined) {
            const statusBool = active_status === "true" ? true : false;
            fieldsToUpdate.push("active_status = ?");
            updateValues.push(statusBool);
        }
        if (position) {
            fieldsToUpdate.push("position = ?");
            updateValues.push(position);
        }

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ message: "No fields provided for update." });
        }

        updateQuery += fieldsToUpdate.join(", ") + " WHERE id = ?";
        updateValues.push(id);

        // Execute update query
        await pool.query(updateQuery, updateValues);

        return res.status(200).json({ message: "Deal updated successfully", imageUrl });

    } catch (error) {
        console.error("UpdateDeal Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


exports.GetSingleDealById = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ message: "Deal ID is required." });
        }
        const [deal] = await pool.query(`SELECT * FROM cp_deals WHERE id = ?`, [id]);


        return res.status(200).json({ message: "Deals fetched successfully", deal: deal[0] });
    } catch (error) {
        console.error("GetAllDeals Error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};