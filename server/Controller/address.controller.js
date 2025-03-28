const pool = require("../Database/db");

exports.addNewAddress = async (req, res) => {
    try {
        const userId = req.user?.id?.customer_id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User not found." });
        }

        // Destructure data from request body
        const { city, state, pincode, house_no, stree_address, type } = req.body;

        // Check for missing fields
        if (!city || !pincode || !house_no || !stree_address || !type) {
            return res.status(400).json({ message: "All fields are required." });
        }

        // SQL Query
        const sqlQuery = `
            INSERT INTO cp_addresses (user_id, city, pincode, house_no, stree_address, type) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;


        const [result] = await pool.execute(sqlQuery, [
            userId,
            city,

            pincode,
            house_no,
            stree_address,
            type,
        ]);


        return res.status(201).json({
            message: "Address added successfully.",
            addressId: result.insertId,
        });

    } catch (error) {
        console.error("Error adding address:", error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

exports.getMyAddresses = async (req, res) => {
    try {
        const userId = req.user?.id?.customer_id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User not found." });
        }
        // SQL Query
        const sqlQuery = `
            SELECT * FROM cp_addresses WHERE user_id =?
        `;
        const [addresses] = await pool.execute(sqlQuery, [userId]);
        return res.status(200).json({ addresses });

    } catch (error) {
        console.error("Error getting addresses:", error);
        return res.status(500).json({ message: "Internal server error." });

    }
}

exports.updateMyAddress = async (req, res) => {
    try {
        const userId = req.user?.id?.customer_id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User not found." });
        }

        const addressId = parseInt(req.params.addressId);

        // Destructure data from request body
        const { city, pincode, house_no, stree_address, type } = req.body;

        // Initialize an array to hold values for the query and a string to build the SET clause dynamically
        const updateFields = [];
        const values = [];

        // Dynamically add fields to the update query if they are provided
        if (city) {
            updateFields.push("city = ?");
            values.push(city);
        }

        if (pincode) {
            updateFields.push("pincode = ?");
            values.push(pincode);
        }
        if (house_no) {
            updateFields.push("house_no = ?");
            values.push(house_no);
        }
        if (stree_address) {
            updateFields.push("stree_address = ?");
            values.push(stree_address);
        }
        if (type) {
            updateFields.push("type = ?");
            values.push(type);
        }

        // If no fields were provided to update, return an error
        if (updateFields.length === 0) {
            return res.status(400).json({ message: "No fields to update." });
        }

        // Add userId and addressId to the end of values array
        values.push(userId, addressId);

        // Construct the SQL query dynamically
        const sqlQuery = `
            UPDATE cp_addresses
            SET ${updateFields.join(", ")}
            WHERE user_id = ? AND ad_id = ?
        `;

        // Execute the SQL query
        await pool.execute(sqlQuery, values);

        return res.status(200).json({ message: "Address updated successfully." });

    } catch (error) {
        console.error('Error updating address:', error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

exports.deleteMyAddress = async (req, res) => {
    try {
        const userId = req.user?.id?.customer_id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User not found." });
        }
        const addressId = parseInt(req.params.addressId);

        // SQL Query
        const sqlQuery = `
            DELETE FROM cp_addresses
            WHERE user_id = ? AND ad_id = ?
        `;
        await pool.execute(sqlQuery, [userId, addressId]);
        return res.status(200).json({ message: "Address deleted successfully." });

    } catch (error) {
        console.error('Error deleting address:', error);
        return res.status(500).json({ message: "Internal server error." });
    }
}

exports.check_area_availability = async (req, res) => {
    try {
        const { city } = req.body;

        console.log("City", city)
        if (!city || city.trim() === "") {
            return res.status(400).json({ success: false, message: "City name is required" });
        }


        const query = `SELECT * FROM cp_serviceable_city WHERE city = ? AND status = 1`;
        const [result] = await pool.execute(query, [city]);

        console.log("result", result)
        if (result.length > 0) {
            return res.status(200).json({
                success: true,
                data: result[0],
                message: `Good news! We deliver to '${city}' and your order will arrive in ${result[0]?.E_T_D}.`
            });
        } else {
            return res.status(404).json({
                success: false,
                message: `We’re sorry, but the city '${city}' is not currently in our serviceable areas. Please check back later or contact our support team for more details.`
            });
        }

    } catch (error) {

        console.error("Error checking area availability:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};



exports.getAllAddresses = async (req, res) => {
    try {

        const sqlQuery = `
            SELECT * FROM cp_addresses
        `;
        const [addresses] = await pool.execute(sqlQuery);
        return res.status(200).json({ addresses });

    } catch (error) {
        console.error("Error getting addresses:", error);
        return res.status(500).json({ message: "Internal server error." });

    }
}

exports.getSingleAddresses = async (req, res) => {
    try {
        const addressId = parseInt(req.params.addressId);

        // Input validation
        if (isNaN(addressId) || addressId <= 0) {
            return res.status(400).json({ 
                message: "Invalid address ID" 
            });
        }

        const sqlQuery = `SELECT * FROM cp_addresses WHERE ad_id = ?`;
        const [addresses] = await pool.execute(sqlQuery, [addressId]);

        // Check if address exists
        if (addresses.length === 0) {
            return res.status(404).json({ 
                message: "Address not found" 
            });
        }

        return res.status(200).json({ 
            address: addresses[0] // Return first address, not array
        });

    } catch (error) {
        // Replace with proper logging
        console.error("Error getting addresses:", error);
        
        return res.status(500).json({ 
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


exports.updateAnyAddress = async (req, res) => {
    try {
        const userId = req.query?.id || {}
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User not found." });
        }

        const addressId = parseInt(req.params.addressId);

        // Destructure data from request body
        const { city, pincode, house_no, stree_address, type } = req.body;

        // Initialize an array to hold values for the query and a string to build the SET clause dynamically
        const updateFields = [];
        const values = [];

        // Dynamically add fields to the update query if they are provided
        if (city) {
            updateFields.push("city = ?");
            values.push(city);
        }

        if (pincode) {
            updateFields.push("pincode = ?");
            values.push(pincode);
        }
        if (house_no) {
            updateFields.push("house_no = ?");
            values.push(house_no);
        }
        if (stree_address) {
            updateFields.push("stree_address = ?");
            values.push(stree_address);
        }
        if (type) {
            updateFields.push("type = ?");
            values.push(type);
        }

        // If no fields were provided to update, return an error
        if (updateFields.length === 0) {
            return res.status(400).json({ message: "No fields to update." });
        }

        // Add userId and addressId to the end of values array
        values.push(userId, addressId);

        // Construct the SQL query dynamically
        const sqlQuery = `
            UPDATE cp_addresses
            SET ${updateFields.join(", ")}
            WHERE user_id = ? AND ad_id = ?
        `;

        // Execute the SQL query
        await pool.execute(sqlQuery, values);

        return res.status(200).json({ message: "Address updated successfully." });

    } catch (error) {
        console.error('Error updating address:', error);
        return res.status(500).json({ message: "Internal server error." });
    }
};


exports.deleteAnyAddress = async (req, res) => {
    try {
        const userId = req.query?.id || {}
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. User not found." });
        }
        const addressId = parseInt(req.params.addressId);

        // SQL Query
        const sqlQuery = `
            DELETE FROM cp_addresses
            WHERE user_id = ? AND ad_id = ?
        `;
        await pool.execute(sqlQuery, [userId, addressId]);
        return res.status(200).json({ message: "Address deleted successfully." });

    } catch (error) {
        console.error('Error deleting address:', error);
        return res.status(500).json({ message: "Internal server error." });
    }
}