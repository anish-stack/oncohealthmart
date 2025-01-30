const crypto = require('crypto');
const Pool = require('../Database/db');
const OtpService = require('../service/otp.service');
const moment = require('moment');
const sendToken = require('../utils/SendToken');

exports.register = async (req, res) => {
    try {
        const { customer_name, password, email_id, mobile, platform } = req.body;

        // Validate input fields
        const errors = [];
        if (!customer_name) errors.push('Customer name is required.');
        if (!password) errors.push('Password is required.');
        if (!email_id) errors.push('Email ID is required.');
        if (!mobile) errors.push('Mobile number is required.');
        if (!platform) errors.push('Platform is required.');

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        // Hash password using SHA1
        const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

        const registration_date = new Date();
        const flag = 'Customer';
        const status = 'Inactive';

        // Check if user already exists
        const userCheckSql = `
            SELECT * FROM cp_customer
            WHERE email_id =? OR mobile =?
        `;
        const userCheckValues = [email_id, mobile];
        const [userExists] = await Pool.execute(userCheckSql, userCheckValues);
        // console.log(userExists)
        if (userExists && userExists.length > 0) {
            return res.status(400).json({
                errors: ['Email ID or Mobile number already registered.'],
            });
        }

        // Generate OTP
        const otpService = new OtpService();
        const generateOtp = crypto.randomInt(100000, 999999);
        const currentTime = new Date();
        const otpExpiresAt = new Date(currentTime.getTime() + 5 * 60 * 1000);
        console.log('Generated OTP:', generateOtp + 'And Expiry:', otpExpiresAt);

        // Send OTP via SMS
        try {
            await otpService.sendOtp(`+91${mobile}`, 'RegistrationConfirmation', generateOtp);
            console.log('OTP sent successfully');
        } catch (err) {
            console.error('Error sending OTP:', err.message);
            return res.status(500).json({ message: 'Error sending OTP. Please try again later.' });
        }

        // Save the user to the database
        const sql = `
            INSERT INTO cp_customer (customer_name, password, email_id, mobile, registration_date, flag, status, platform,otp,otp_expires)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [customer_name, hashedPassword, email_id, mobile, registration_date, flag, status, platform, generateOtp, otpExpiresAt];
        const [result] = await Pool.execute(sql, values);

        res.status(201).json({
            message: 'User registered successfully. OTP has been sent.',
            userId: result.insertId,
        });

    } catch (error) {
        console.error('Error registering user:', error.message);
        res.status(500).json({ message: 'Internal Server Error.' });
    }
};



exports.VerifyOtp = async (req, res) => {
    try {
        const type = req.query.type;


        if (type === 'change_password') {
            const { customer_id, password, otp } = req.body;

            // if (!password || !otp) {
            //     return res.status(400).json({ message: 'Password and OTP are required.' });
            // }

            const userCheckSql = `
                SELECT * FROM cp_customer
                WHERE customer_id = ?
            `;
            const [userExists] = await Pool.execute(userCheckSql, [customer_id]);

            if (userExists.length === 0) {
                return res.status(404).json({ message: 'User not found.' });
            }


            // if (userExists[0].otp !== otp) {
            //     return res.status(400).json({ message: 'Invalid OTP.' });
            // }


            const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');
            const updatePasswordSql = `
            UPDATE cp_customer
            SET password = ?, otp = '', otp_expires = ''
            WHERE customer_id = ?
        `;
            const updatePasswordValues = [hashedPassword, customer_id];
            await Pool.execute(updatePasswordSql, updatePasswordValues);

            res.status(200).json({ message: 'Password updated successfully.' });
        } else {

            const { userId, otp } = req.body;

            if (!userId || !otp) {
                return res.status(400).json({ message: 'User ID and OTP are required.' });
            }

            const userCheckSql = `
                SELECT * FROM cp_customer
                WHERE customer_id = ?
            `;
            const [userExists] = await Pool.execute(userCheckSql, [userId]);

            if (userExists.length === 0) {
                return res.status(404).json({ message: 'User not found.' });
            }

            const user = userExists[0];
            const otpExpiry = moment(user.otp_expires);
            const currentTime = moment();


            if (currentTime.isAfter(otpExpiry)) {
                return res.status(400).json({ message: 'OTP has expired.' });
            }


            if (user.otp !== otp) {
                return res.status(400).json({ message: 'Invalid OTP.' });
            }

            // Update user status
            const updateStatusSql = `
                UPDATE cp_customer
                SET status = 'Active', otp = '', otp_expires = ''
                WHERE customer_id = ?
            `;
            await Pool.execute(updateStatusSql, [userId]);

            res.status(200).json({ message: 'OTP verified successfully.' });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error.message);
        res.status(500).json({ message: 'Internal Server Error.' });
    }
};


exports.resendOtp = async (req, res) => {
    try {
        console.log("i am resending")
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'user id is required.' });
        }

        const userCheckSql = `
            SELECT * FROM cp_customer
            WHERE customer_id = ?
        `;

        const [userExists] = await Pool.execute(userCheckSql, [userId]);

        if (userExists.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const user = userExists[0];
        if (user.status === 'Active') {
            return res.status(400).json({ message: 'Mobile Number is already Verified' });
        }
        const otpService = new OtpService();
        const generateOtp = crypto.randomInt(100000, 999999);
        const currentTime = new Date();
        const otpExpiresAt = new Date(currentTime.getTime() + 5 * 60 * 1000);
        console.log('Generated OTP:', generateOtp + 'And Expiry:', otpExpiresAt);


        try {
            await otpService.sendOtp(`+91${user.mobile}`, 'RegistrationConfirmation', generateOtp);
            console.log('OTP sent successfully');
        } catch (err) {
            console.error('Error sending OTP:', err.message);
            return res.status(500).json({ message: 'Error sending OTP. Please try again later.' });
        }

        const updateStatusSql = `
        UPDATE cp_customer
        SET otp =?, otp_expires =?
        WHERE customer_id = ?
        `;

        await Pool.execute(updateStatusSql, [generateOtp, otpExpiresAt, userId]);

        res.status(200).json({ message: 'OTP resent successfully.',otp:generateOtp });


    } catch (error) {
        console.log(error.message)
        res.status(500).json({
            success: false,
            message: error?.message
        })
    }
}

exports.forgotPassword = async (req, res) => {
    try {
        const { email_id } = req.body;
        const userCheckSql = `
            SELECT * FROM cp_customer
            WHERE email_id = ?
        `;
        const [userExists] = await Pool.execute(userCheckSql, [email_id]);

        if (userExists.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const user = userExists[0];
        const otpService = new OtpService();
        const generateOtp = crypto.randomInt(100000, 999999);
        const currentTime = new Date();
        const otpExpiresAt = new Date(currentTime.getTime() + 5 * 60 * 1000)
        console.log('Generated OTP:', generateOtp, 'And Expiry:', otpExpiresAt);

        try {
            await otpService.sendOtp(`+91${user.mobile}`, 'RegistrationConfirmation', generateOtp);
            console.log('OTP sent successfully');
        } catch (err) {
            console.error('Error sending OTP:', err.message);
            return res.status(500).json({ message: 'Error sending OTP. Please try again later.' });
        }

        const updateStatusSql = `
            UPDATE cp_customer
            SET otp = ?, otp_expires = ?
            WHERE customer_id = ?
        `;
        await Pool.execute(updateStatusSql, [generateOtp, otpExpiresAt, user.customer_id]);

        res.status(200).json({ message: 'OTP sent successfully.' });

    } catch (error) {
        console.error('Error forgot password:', error.message);
        res.status(500).json({ message: 'Internal Server Error.' });
    }
};

exports.login = async (req, res) => {
    try {
        const { mobile } = req.body;

        const userCheckSql = `
            SELECT * FROM cp_customer
            WHERE mobile = ?
        `;

        const [userExists] = await Pool.execute(userCheckSql, [mobile]);
        if (userExists.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const user = userExists[0];
        if (user.status === 'Inactive') {
            return res.status(401).json({ message: 'Please Verify Your Mobile Number To Login Your Account' });
        }

        const otpService = new OtpService();
        const generateOtp = crypto.randomInt(100000, 999999);
        const currentTime = new Date();
        const otpExpiresAt = new Date(currentTime.getTime() + 5 * 60 * 1000);

        console.log('Generated OTP:', generateOtp + ' And Expiry:', otpExpiresAt);

        try {
            await otpService.sendOtp(`+91${mobile}`, 'RegistrationConfirmation', generateOtp);
            console.log('OTP sent successfully');
        } catch (err) {
            console.error('Error sending OTP:', err.message);
            return res.status(500).json({ message: 'Error sending OTP. Please try again later.' });
        }

        const updateStatusSql = `
        UPDATE cp_customer
        SET otp = ?, otp_expires = ?
        WHERE customer_id = ?
        `;
        await Pool.execute(updateStatusSql, [generateOtp, otpExpiresAt, user.customer_id]);
        await sendToken(user, res, generateOtp, 200)
        // res.status(200).json({
        //     message: 'OTP sent successfully.',
        //     otp_expiry: otpExpiresAt,
        //     success: true,
        //     data: user,
        //     otp: generateOtp,
        // });

    } catch (error) {
        console.error('Error logging in:', error.message);
        res.status(500).json({ message: 'Internal Server Error.' });
    }
};

exports.logout = async (req, res) => {
    try {
        res.clearCookie('token');
        res.status(200).json({ message: 'Logged out successfully.' });
    } catch (error) {
        console.error('Error logging out:', error.message);
        res.status(500).json({ message: 'Internal Server Error.' });
    }
}

exports.updateDetails = async (req, res) => {
    try {
        const userId = req.user.id?.customer_id;
        if (!userId) {
            return res.status(401).json({ message: 'Please login to access this resource' });
        }


        const findUserSql = `
            SELECT * FROM cp_customer WHERE customer_id = ?
        `;
        const [userExists] = await Pool.execute(findUserSql, [userId]);

        if (userExists.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = userExists[0];

        // Get the fields from the request body
        const updatedFields = req.body;
        const fieldsToUpdate = [];

        const values = [];


        if (updatedFields.customer_name && updatedFields.customer_name !== user.customer_name) {
            fieldsToUpdate.push('customer_name = ?');
            values.push(updatedFields.customer_name);
        }
        if (updatedFields.email_id && updatedFields.email_id !== user.email_id) {
            fieldsToUpdate.push('email_id = ?');
            values.push(updatedFields.email_id);
        }
        if (updatedFields.mobile && updatedFields.mobile !== user.mobile) {
            fieldsToUpdate.push('mobile = ?');
            values.push(updatedFields.mobile);
        }
        if (updatedFields.address && updatedFields.address !== user.address) {
            fieldsToUpdate.push('address = ?');
            values.push(updatedFields.address);
        }
        if (updatedFields.pincode && updatedFields.pincode !== user.pincode) {
            fieldsToUpdate.push('pincode = ?');
            values.push(updatedFields.pincode);
        }


        if (fieldsToUpdate.length > 0) {
            const updateUserSql = `
                UPDATE cp_customer
                SET ${fieldsToUpdate.join(', ')}
                WHERE customer_id = ?
            `;
            values.push(userId);

            await Pool.execute(updateUserSql, values);
            return res.status(200).json({ message: 'User details updated successfully' });
        } else {
            return res.status(400).json({ message: 'No details to update' });
        }

    } catch (error) {
        console.error('Error updating user details:', error.message);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.getMyProfile = async (req, res) => {
    try {
        // console.log("i am hit",req.user)
        const userId = req.user.id?.customer_id;
        console.log(userId)
        if (!userId) {
            return res.status(401).json({ message: 'Please login to access this resource' });
        }
        const findUserSql = `
            SELECT * FROM cp_customer WHERE customer_id = ?
        `;
        const [userExists] = await Pool.execute(findUserSql, [userId]);
        if (userExists.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.status(200).json({ user: userExists[0] });

    } catch (error) {
        console.error('Error getting user profile:', error.message);
        res.status(500).json({ message: 'Internal Server Error' });

    }
}