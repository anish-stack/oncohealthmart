const Pool = require('../Database/db');


exports.getSetting = async (req, res) => {
    try {
        const query = `SELECT * FROM cp_settings`
        const [rows] = await Pool.execute(query)
        if (rows.length === 0) {
            return res.status(404).json({ message: 'No settings found.' });
        }
        res.status(200).json({
            success: true,
            message: 'Settings fetched successfully.',
            settings: rows[0]
        });
    } catch (error) {
        res.status(501).json({
            success: false,
            message: 'Settings fetched failed.',
            error: error.message
        });
    }
}