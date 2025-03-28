const pool = require("../Database/db");
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images are allowed.'), false);
        }
    }
});


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload image to Cloudinary
const uploadToCloudinary = (file) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'news_images' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        
        uploadStream.end(file.buffer);
    });
};


exports.createNews = [
  
    upload.single('image'),
    
    async (req, res) => {
        try {
            const { 
                title, 
                category, 
                excerpt, 
                content, 
                date, 
                status 
            } = req.body;

          
            if (!title || !category || !content) {
                return res.status(400).json({
                    success: false,
                    message: "Title, category, and content are required"
                });
            }

            // Image upload handling
            let imageUrl = null;
            if (req.file) {
                try {
                    const cloudinaryResponse = await uploadToCloudinary(req.file);
                    imageUrl = cloudinaryResponse.secure_url;
                } catch (uploadError) {
                    return res.status(500).json({
                        success: false,
                        message: "Failed to upload image",
                        error: uploadError.message
                    });
                }
            }

         
            const insertQuery = `
                INSERT INTO cp_news_table (
                    title, 
                    category, 
                    excerpt, 
                    image, 
                    content, 
                    date, 
                    status, 
                    created_at, 
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `;

            const [result] = await pool.execute(insertQuery, [
                title,
                category,
                excerpt || null,
                imageUrl,
                content,
                date || new Date(),
                status || 'active'
            ]);

            res.status(201).json({
                success: true,
                message: "News article created successfully",
                newsId: result.insertId,
                imageUrl: imageUrl
            });
        } catch (error) {
            console.error("Error creating news article:", error);
            res.status(500).json({
                success: false,
                message: "Failed to create news article",
                error: error.message
            });
        }
    }
];

exports.updateNews = [
    upload.single('image'),
    async (req, res) => {
        try {
            const newsId = parseInt(req.params.newsId);

            if (isNaN(newsId) || newsId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid news article ID"
                });
            }

            const {
                title,
                category,
                excerpt,
                content,
                date,
                status
            } = req.body;

            const updateFields = [];
            const updateValues = [];

            // Fetch the current image URL from the database
            const [existingNews] = await pool.execute(
                `SELECT image FROM cp_news_table WHERE id = ?`, [newsId]
            );

            if (existingNews.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "News article not found"
                });
            }

            if (title) {
                updateFields.push('title = ?');
                updateValues.push(title);
            }
            if (category) {
                updateFields.push('category = ?');
                updateValues.push(category);
            }
            if (excerpt) {
                updateFields.push('excerpt = ?');
                updateValues.push(excerpt);
            }
            if (content) {
                updateFields.push('content = ?');
                updateValues.push(content);
            }
            if (date) {
                updateFields.push('date = ?');
                updateValues.push(date);
            }
            if (status) {
                updateFields.push('status = ?');
                updateValues.push(status);
            }

            let imageUrl = existingNews[0].image;

            if (req.file) {
                try {
                    // Delete the old image from Cloudinary if it exists
                    if (imageUrl) {
                        const publicId = imageUrl.split('/').pop().split('.')[0];
                        await cloudinary.uploader.destroy(publicId);
                    }

                    // Upload the new image to Cloudinary
                    const cloudinaryResponse = await uploadToCloudinary(req.file);
                    imageUrl = cloudinaryResponse.secure_url;

                    updateFields.push('image = ?');
                    updateValues.push(imageUrl);
                } catch (uploadError) {
                    return res.status(500).json({
                        success: false,
                        message: "Failed to upload image",
                        error: uploadError.message
                    });
                }
            }

            updateFields.push('updated_at = NOW()');
            updateValues.push(newsId);

            if (updateFields.length === 1) {
                return res.status(400).json({
                    success: false,
                    message: "No update data provided"
                });
            }

            const updateQuery = `
                UPDATE cp_news_table 
                SET ${updateFields.join(', ')} 
                WHERE id = ?
            `;

            const [result] = await pool.execute(updateQuery, updateValues);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "News article not found"
                });
            }

            res.status(200).json({
                success: true,
                message: "News article updated successfully",
                updatedRows: result.affectedRows,
                imageUrl: imageUrl
            });
        } catch (error) {
            console.error("Error updating news article:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update news article",
                error: error.message
            });
        }
    }
];


// Delete News Article
exports.deleteNews = async (req, res) => {
    try {
        const newsId = parseInt(req.params.newsId);

        // Validate news ID
        if (isNaN(newsId) || newsId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid news article ID"
            });
        }

        // Delete query
        const deleteQuery = `DELETE FROM cp_news_table WHERE id = ?`;
        const [result] = await pool.execute(deleteQuery, [newsId]);

        // Check if any rows were deleted
        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "News article not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "News article deleted successfully",
            deletedRows: result.affectedRows
        });
    } catch (error) {
        console.error("Error deleting news article:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete news article",
            error: error.message
        });
    }
};

// Error handling middleware for Multer
exports.multerErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: "File upload error",
            error: err.message
        });
    } else if (err) {
        return res.status(500).json({
            success: false,
            message: "Unknown upload error",
            error: err.message
        });
    }
    next();
};