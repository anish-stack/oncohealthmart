const axios = require("axios");

const sendMessage = async ({ mobile, msg, pdf = "", img1 = "https://i.ibb.co/dsXmff0g/7171668-3544858.jpg", img2 = "", scheduleon = "" }) => {
    try {
        const API_URL = "http://api.wtap.sms4power.com/wapp/api/send/json";
        const API_KEY = "97faabee8618426fa5d23b277dbf58b1";
        let mediaCount = [pdf, img1, img2].filter(item => item).length;
        let creditsUsed = mediaCount > 0 ? mediaCount : 1;

        const payload = {
            mobile,
            msg,
            ...(pdf && { pdf }),
            ...(img1 && { img1 }),
            ...(img2 && { img2 }),
            ...(scheduleon && { scheduleon }),
        };

        const headers = {
            "X-API-KEY": API_KEY,
            "Content-Type": "application/json",
        };

        const response = await axios.post(API_URL, payload, { headers });

        return {
            success: true,
            data: response.data,
            creditsUsed,
        };
    } catch (error) {
        return {
            success: false,
            error: error.response ? error.response.data : error.message,
        };
    }
};

module.exports = sendMessage;
