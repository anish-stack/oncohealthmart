const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_EMAIL_HOST,
        port: process.env.SMTP_EMAIL_PORT,
        secure: false,
        tls: {
            rejectUnauthorized: false, 
        },
        auth: {
            user: process.env.SMTP_EMAIL_ADDRESS,
            pass: process.env.SMTP_EMAIL_PASSWORD,
        },
    });

    const mailOptions = {
        from: `Onco Health Mart <${process.env.SMTP_EMAIL_ADDRESS}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html, 
        attachments: options.attachments,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully!');
        return true
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = sendEmail;
