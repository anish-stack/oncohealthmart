const jwt = require('jsonwebtoken');

const sendToken = async (user, res, otp, StatusCode) => {
    try {
        const token = jwt.sign({ id: user }, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });

        const options = {
            path: "/",
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
        };

        res.cookie('token', token, options);

        res.status(StatusCode).json({
            success: true,
            otp: otp,
            login: user,
            token: token,
            expiresIn: 30 * 24 * 60 * 60,
        });
    } catch (error) {
        console.log("Error in generating token:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};

module.exports = sendToken;
