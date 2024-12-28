const axios = require('axios');
require('dotenv').config(); 

class OtpService {
    async sendOtp(receiverNumber, template, var1) {
        try {
          
            const requestBody = {
                From: "ONCOHM",
                To: receiverNumber,
                TemplateName: template,
                VAR1: var1
            };

        
            const response = await axios.post(
                `http://2factor.in/API/V1/${process.env.FAST2SMS}/ADDON_SERVICES/SEND/TSMS`,
                requestBody, 
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            console.log("SMS sent successfully:", response.data);
            return response.data; 
        } catch (error) {
            console.error("Error sending SMS:", error.message);
            throw new Error('Error sending OTP');
        }
    }
}

module.exports = OtpService;
