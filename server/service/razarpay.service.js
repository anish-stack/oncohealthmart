const axios = require('axios');
require('dotenv').config();
const Razorpay = require('razorpay');
const { validatePaymentVerification } = require('razorpay/dist/utils/razorpay-utils');
const pool = require("../Database/db");

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_live_ZsgrnmlprofCTY',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'VO0ZgCvszSNjIqqU81vW9fCa',
});

class CreateOrderRazorpay {
    async createOrder(amount) {
        try {
            // Create a new order in Razorpay
            const options = {
                amount: Number(amount) * 100, // Convert to paise
                currency: "INR",
                receipt: `order_rcptid_${Date.now()}`, // Unique receipt ID
            };

            const order = await instance.orders.create(options);

            if (!order || !order.id) {
                throw new Error('Failed to create order with Razorpay');
            }

            return order;
        } catch (error) {
            console.error('Error creating Razorpay order:', error);
            throw new Error('Error creating Razorpay order');
        }
    }
}

class PaymentVerification {
    async verifyPayment(data) {
        try {
            const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = data;


            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                throw new Error('Invalid payment data');
            }

            // Verify the payment signature
            const isValidSignature = validatePaymentVerification(
                { order_id: razorpay_order_id, payment_id: razorpay_payment_id },
                razorpay_signature,
                process.env.RAZORPAY_KEY_SECRET || "VO0ZgCvszSNjIqqU81vW9fCa"
            );

            if (!isValidSignature) {
                throw new Error('Invalid payment signature');
            }


            return true
        } catch (error) {

            console.error('Error verifying payment:', error.message);
            throw new Error('Error verifying payment');
        }
    }
}

module.exports = {
    CreateOrderRazorpay,
    PaymentVerification,
};
