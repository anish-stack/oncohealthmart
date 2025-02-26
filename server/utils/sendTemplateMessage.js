const axios = require("axios");

const sendTemplateMessage = async ({ mobile, templatename }) => {
    try {
        const API_URL = "http://api.wtap.sms4power.com/wapp/api/send/template";
        const API_KEY = "97faabee8618426fa5d23b277dbf58b1"; 

        const params = {
            apikey: API_KEY,
            mobile,
            templatename,
        };

        const response = await axios.get(API_URL, { params });

        return {
            success: true,
            data: response.data,
        };
    } catch (error) {
        return {
            success: false,
            error: error.response ? error.response.data : error.message,
        };
    }
};

module.exports = sendTemplateMessage;
