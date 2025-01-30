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
