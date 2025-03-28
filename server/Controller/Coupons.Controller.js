const pool = require("../Database/db");



exports.FindAllCoupons = async (req, res) => {
    try {

        const allCouponsQuery = `SELECT * FROM cp_app_offer WHERE 1`;

        const [rows] = await pool.execute(allCouponsQuery);

        res.status(200).json({
            success: true,
            data: rows,
            message: "All coupons fetched successfully",
        });
    } catch (error) {
        console.error("Error fetching coupons:", error);

        // Send error response
        res.status(500).json({
            success: false,
            message: "Failed to fetch coupons",
            error: error.message,
        });
    }
};

// Create a new coupon
exports.createCoupon = async (req, res) => {
    try {
        const { 
            title, 
            desc_code, 
            min_order_value, 
            status, 
            CODE, 
            percenatge_off, 
            theme, 
            maxDiscount, 
            discount_type 
        } = req.body;

        // Validate required fields
        if (!title || !CODE || !percenatge_off) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const insertQuery = `
            INSERT INTO cp_app_offer (
                title, 
                desc_code, 
                min_order_value, 
                status, 
                CODE, 
                percenatge_off, 
                theme, 
                maxDiscount, 
                discount_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.execute(insertQuery, [
            title, 
            desc_code || null, 
            min_order_value || null, 
            status || 'active', 
            CODE, 
            percenatge_off, 
            theme || null, 
            maxDiscount || null, 
            discount_type || null
        ]);

        res.status(201).json({
            success: true,
            message: "Coupon created successfully",
            couponId: result.insertId
        });
    } catch (error) {
        console.error("Error creating coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create coupon",
            error: error.message
        });
    }
};

// Get All Coupons
exports.getAllCoupons = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status 
        } = req.query;

        const offset = (page - 1) * limit;

        // Base query
        let countQuery = `SELECT COUNT(*) as total FROM cp_app_offer`;
        let allCouponsQuery = `SELECT * FROM cp_app_offer`;

        // Add status filter if provided
        const whereConditions = [];
        const queryParams = [];

        if (status) {
            whereConditions.push(`status = ?`);
            queryParams.push(status);
        }

        // Apply where conditions
        if (whereConditions.length > 0) {
            countQuery += ` WHERE ${whereConditions.join(' AND ')}`;
            allCouponsQuery += ` WHERE ${whereConditions.join(' AND ')}`;
        }

        // Add pagination
        allCouponsQuery += ` LIMIT ? OFFSET ?`;
        queryParams.push(parseInt(limit), parseInt(offset));

        // Get total count
        const [countResult] = await pool.execute(countQuery);
        const totalCoupons = countResult[0].total;

        // Get paginated results
        const [rows] = await pool.execute(allCouponsQuery, queryParams);

        res.status(200).json({
            success: true,
            data: rows,
            pagination: {
                total: totalCoupons,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalCoupons / limit)
            },
            message: "Coupons fetched successfully"
        });
    } catch (error) {
        console.error("Error fetching coupons:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch coupons",
            error: error.message
        });
    }
};

// Get Single Coupon
exports.getSingleCoupon = async (req, res) => {
    try {
        const couponId = parseInt(req.params.couponId);

        if (isNaN(couponId) || couponId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid coupon ID"
            });
        }

        const [rows] = await pool.execute(
            `SELECT * FROM cp_app_offer WHERE id = ?`, 
            [couponId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        res.status(200).json({
            success: true,
            data: rows[0],
            message: "Coupon fetched successfully"
        });
    } catch (error) {
        console.error("Error fetching coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch coupon",
            error: error.message
        });
    }
};

// Update Coupon
exports.updateCoupon = async (req, res) => {
    try {
        const couponId = parseInt(req.params.couponId);
        const updateData = req.body;

        if (isNaN(couponId) || couponId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid coupon ID"
            });
        }

        // Check if there's data to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No update data provided"
            });
        }

        // Prepare update query dynamically
        const updateFields = [];
        const updateValues = [];

        const allowedFields = [
            'title', 'desc_code', 'min_order_value', 
            'status', 'CODE', 'percenatge_off', 
            'theme', 'maxDiscount', 'discount_type'
        ];

        // Build dynamic update query
        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = ?`);
                updateValues.push(updateData[key]);
            }
        });

        // Add couponId to values
        updateValues.push(couponId);

        const updateQuery = `
            UPDATE cp_app_offer 
            SET ${updateFields.join(', ')} 
            WHERE id = ?
        `;

        
        const [result] = await pool.execute(updateQuery, updateValues);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found or no changes made"
            });
        }

        res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            updatedRows: result.affectedRows
        });
    } catch (error) {
        console.error("Error updating coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update coupon",
            error: error.message
        });
    }
};

// Delete Coupon
exports.deleteCoupon = async (req, res) => {
    try {
        const couponId = parseInt(req.params.couponId);

        if (isNaN(couponId) || couponId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid coupon ID"
            });
        }

        const [result] = await pool.execute(
            `DELETE FROM cp_app_offer WHERE id = ?`, 
            [couponId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Coupon deleted successfully",
            deletedRows: result.affectedRows
        });
    } catch (error) {
        console.error("Error deleting coupon:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete coupon",
            error: error.message
        });
    }
};