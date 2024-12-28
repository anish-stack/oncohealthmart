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
        if (!city || !state || !pincode || !house_no || !stree_address || !type) {
            return res.status(400).json({ message: "All fields are required." });
        }

        // SQL Query
        const sqlQuery = `
            INSERT INTO cp_addresses (user_id, city, state, pincode, house_no, stree_address, type) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;


        const [result] = await pool.execute(sqlQuery, [
            userId,
            city,
            state,
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
        const { city, state, pincode, house_no, stree_address, type } = req.body;
        
        // Initialize an array to hold values for the query and a string to build the SET clause dynamically
        const updateFields = [];
        const values = [];

        // Dynamically add fields to the update query if they are provided
        if (city) {
            updateFields.push("city = ?");
            values.push(city);
        }
        if (state) {
            updateFields.push("state = ?");
            values.push(state);
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