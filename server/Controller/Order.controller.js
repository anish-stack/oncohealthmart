const pool = require("../Database/db");
const crypto = require('crypto');
const { CreateOrderRazorpay, PaymentVerification } = require("../service/razarpay.service");
const cloudinary = require('cloudinary').v2;
const html_to_pdf = require('html-pdf-node');
const sendEmail = require("../utils/sendEmail");
const fs = require('fs');
const sendMessage = require("../utils/Send_Whatsapp");


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
})

exports.GetMyOrder = async (req, res) => {
    try {
        const user = req.user?.id?.customer_id;
        if (!user) {
            return res.status(400).json({ message: 'User not found' });
        }

        const sqlQuery = `SELECT * FROM cp_order WHERE customer_id = ?`;
        const [orders] = await pool.execute(sqlQuery, [user]);

        if (orders.length === 0) {
            return res.status(404).json({ message: 'No orders found' });
        }


        orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

        // Pagination
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        const paginatedOrders = orders.slice(startIndex, endIndex);

        // Extract order IDs from paginated orders
        const orderIds = paginatedOrders.map(order => order.order_id);

        // If no order IDs, skip fetching details
        if (orderIds.length === 0) {
            return res.status(200).json({
                message: 'Orders fetched successfully',
                data: [],
                totalPages: Math.ceil(orders.length / limit),
            });
        }

        // Fetch order details for the paginated orders
        const orderDetailsSql = `SELECT * FROM cp_order_details WHERE order_id IN (${orderIds.map(() => '?').join(',')})`;
        const [orderDetails] = await pool.execute(orderDetailsSql, orderIds);

        // Map order details by order ID
        const orderDetailsMap = orderDetails.reduce((map, detail) => {
            map[detail.order_id] = map[detail.order_id] || [];
            map[detail.order_id].push(detail);
            return map;
        }, {});

        // Combine orders with their details
        const updatedOrders = paginatedOrders.map(order => {
            order.details = orderDetailsMap[order.order_id] || [];
            return order;
        });

        res.status(200).json({
            message: 'Orders fetched successfully',
            data: updatedOrders,
            totalPages: Math.ceil(orders.length / limit),
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.UploadPrescription = (req, res) => {
    try {
        const { customer_id } = req.body;
        const file = req.file;

        console.log("Received File:", file);

        if (!file) {
            return res.status(400).json({ message: 'File is required' });
        }

        const NameOfPrescription = crypto.randomBytes(6).toString('hex');
        let data;
        // Upload to Cloudinary using upload_stream
        const stream = cloudinary.uploader.upload_stream(
            {
                public_id: `prescriptions/${NameOfPrescription}`,
                folder: 'prescriptions',
            },
            async (err, result) => {
                if (err) {
                    console.error("Cloudinary Upload Error:", err);
                    return res.status(500).json({ message: 'Error while uploading the prescription', error: err });
                }

                const fileUrl = result.secure_url;
                const filePublicId = result.public_id;

                console.log("Uploaded File URL & Public ID:", fileUrl, filePublicId);

                // Insert into the database
                const sqlQuery = `
                    INSERT INTO cp_prescription (customer_id, prescription_name, prescription_file, type)
                    VALUES (?, ?, ?, ?)
                `;
                const values = [customer_id, NameOfPrescription, fileUrl, 'App'];

                const dataC = await pool.query(sqlQuery, values, async (err, dbResult) => {
                    if (err) {

                        await cloudinary.uploader.destroy(filePublicId);
                        console.error("Database Error:", err);

                        return res.status(500).json({ message: 'Error while saving the prescription', error: err });
                    }


                });
                return res.status(200).json({ message: 'Prescription uploaded successfully', result: JSON.stringify(dataC[0]?.insertId) });

            }
        );

        // Pipe the file buffer to Cloudinary
        stream.end(file.buffer);


    } catch (error) {
        console.error("Unexpected Error:", error);
        res.status(500).json({ message: 'Something went wrong', error: error.message });
    }
};

exports.CreateOrder = async (req, res) => {
    try {

        const userId = req.user?.id?.customer_id;
        if (!userId) {
            return res.status(400).json({ message: 'Please log in to complete the order.' });
        }

        // Check if user exists in the database
        const checkUserSql = `SELECT * FROM cp_customer WHERE customer_id = ?`;
        const [userExists] = await pool.execute(checkUserSql, [userId]);
        if (userExists?.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }


        const {
            Rx_id,
            address,
            patientName,
            patientPhone,
            hospitalName,
            doctorName,
            parseDataCome,
            prescriptionNotes,
            paymentOption,
            cart,
            payment_mode = 'Razorpay',
        } = req.body;

        console.log("req.body", req.body)
        console.log("req.Rx_id", Rx_id)

        if (!cart?.items || cart?.items?.length === 0) {
            return res.status(400).json({ message: 'Product details are required.' });
        }

        if (!address || !address.stree_address || !address.pincode) {
            return res.status(400).json({ message: 'Delivery address is required.' });
        }

        if (!patientName || !patientPhone) {
            return res.status(400).json({ message: 'Patient details are required.' });
        }
        const query = `SELECT * FROM cp_settings`
        const [rows] = await pool.execute(query)
        if (rows.length === 0) {
            return res.status(404).json({ message: 'No settings found.' });
        }
        const setting = rows[0]

        const shippingCharge = cart?.totalPrice > setting?.shipping_threshold ? 0 : Number(setting?.shipping_charge);
        const extraCharges = paymentOption === "COD" ? setting?.cod_fee : 0
        const Order = {
            order_date: new Date(),
            orderFrom: 'Application',
            customer_id: userExists[0]?.customer_id,
            prescription_id: Rx_id || '',
            hospital_name: hospitalName || '',
            doctor_name: doctorName || '',
            prescription_notes: prescriptionNotes || '',
            customer_name: patientName,
            customer_email: userExists[0]?.email_id,
            customer_phone: patientPhone,
            customer_address: address?.stree_address,
            customer_pincode: address?.pincode,
            customer_shipping_name: patientName,
            customer_shipping_phone: patientPhone,
            customer_shipping_address: address?.stree_address,
            customer_shipping_pincode: address?.pincode,
            amount: cart?.totalPrice,
            subtotal: cart?.totalPrice,
            order_gst: '', // Optional: populate if applicable
            coupon_code: cart?.items?.couponCode || '',
            coupon_discount: cart?.items?.discount || 0,
            shipping_charge: shippingCharge,
            additional_charge: extraCharges,
            payment_mode: payment_mode,
            payment_option: paymentOption || 'Online',
            status: 'Pending',
        };

        const ProductInOrder = cart?.items.map((item) => ({
            product_id: item?.ProductId,
            product_name: item?.title,
            product_image: item?.image,
            unit_price: item?.Pricing,
            unit_quantity: item?.quantity,
            tax_percent: item?.taxPercent || 0,
            tax_amount: item?.taxAmount || 0,
        }));
        const sqlOrderDetails = `
        INSERT INTO cp_order_details 
        (order_id, product_id, product_name, product_image, unit_price, unit_quantity, tax_percent, tax_amount) 
        VALUES (?,?,?,?,?,?,?,?)`;

        const saveOrderSql = `
       INSERT INTO cp_order (
           order_date,orderFrom, customer_id, prescription_id, hospital_name, doctor_name, prescription_notes,
           customer_name, customer_email, customer_phone, customer_address, customer_pincode,
           customer_shipping_name, customer_shipping_phone, customer_shipping_address, customer_shipping_pincode,
           amount, subtotal, order_gst, coupon_code, coupon_discount, shipping_charge, additional_charge,
           payment_mode, payment_option, status
       ) VALUES (
           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?
       )`;

        const saveOrderInTemp = `
       INSERT INTO cp_order_temp (
           order_date,razorpayOrderID,orderFrom, customer_id, prescription_id, hospital_name, doctor_name, prescription_notes,
           customer_name, customer_email, customer_phone, customer_address, customer_pincode,
           customer_shipping_name, customer_shipping_phone, customer_shipping_address, customer_shipping_pincode,
           amount, subtotal, order_gst, coupon_code, coupon_discount, shipping_charge, additional_charge,
           payment_mode, payment_option, status
       ) VALUES (
           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?
       )`;



        const orderValues = Object.values(Order);
        const razarpay = new CreateOrderRazorpay()
        if (paymentOption === 'Online') {
            const amount = cart?.totalPrice
            const sendOrder = await razarpay.createOrder(amount)
            const TemOrder = {
                order_date: new Date(),
                razorpayOrderID: sendOrder.id,
                orderFrom: 'Application',
                customer_id: userExists[0]?.customer_id,
                prescription_id: Rx_id || '',
                hospital_name: hospitalName || '',
                doctor_name: doctorName || '',
                prescription_notes: prescriptionNotes || '',
                customer_name: patientName,
                customer_email: userExists[0]?.email_id,
                customer_phone: patientPhone,
                customer_address: address?.stree_address,
                customer_pincode: address?.pincode,
                customer_shipping_name: patientName,
                customer_shipping_phone: patientPhone,
                customer_shipping_address: address?.stree_address,
                customer_shipping_pincode: address?.pincode,
                amount: cart?.totalPrice,
                subtotal: cart?.totalPrice,
                order_gst: '', // Optional: populate if applicable
                coupon_code: cart?.items?.couponCode || '',
                coupon_discount: cart?.items?.discount || 0,
                shipping_charge: shippingCharge,
                additional_charge: 0,
                payment_mode: payment_mode,
                payment_option: paymentOption || 'Online',
                status: 'Pending',
            };

            const orderValuesTemp = Object.values(TemOrder);
            // console.log(orderValuesTemp)

            const saveOrder = await pool.execute(saveOrderInTemp, orderValuesTemp);
            let items = [];
            let totalPrice = 0;

            for (const item of ProductInOrder) {
                const orderDetailsValues = [
                    saveOrder[0].insertId,
                    item.product_id,
                    item.product_name,
                    item.product_image,
                    item.unit_price,
                    item.unit_quantity,
                    item.tax_percent,
                    item.tax_amount
                ];


                items.push(`🛍 *${item.product_name}* - ₹${item.unit_price} x ${item.unit_quantity}`);

                // Calculate total price
                totalPrice += (item.unit_price * item.unit_quantity) + item.tax_amount;

                try {
                    const details = await pool.execute(sqlOrderDetails, orderDetailsValues);
                    console.log("details", details);
                } catch (error) {
                    console.error('Error inserting product:', error);
                }
            }



            return res.status(201).json({ message: 'Order created successfully.Please Pay !!!', sendOrder });
        } else {
            try {
                // Save order details

                const [orderPlaced] = await pool.execute(saveOrderSql, orderValues);

                // Format the query by replacing `?` placeholders with actual values
                const lastQuery = saveOrderSql.replace(/\?/g, (_, index) =>
                    typeof orderValues[index] === "string" ? `'${orderValues[index]}'` : orderValues[index]
                );

                console.log("Last Executed Query:", lastQuery);

                let items = []; // Initialize items array
                let totalAmount = 0; // Track total amount

                for (const item of ProductInOrder) {
                    const orderDetailsValues = [
                        orderPlaced.insertId,
                        item.product_id,
                        item.product_name,
                        item.product_image,
                        item.unit_price,
                        item.unit_quantity,
                        item.tax_percent,
                        item.tax_amount
                    ];

                    try {
                        const details = await pool.execute(sqlOrderDetails, orderDetailsValues);
                        console.log(`Product inserted: ${item.product_name}`, details);
                    } catch (error) {
                        console.error(`Error inserting product ${item.product_name}:`, error);
                    }

                    // Add item details for the message
                    items.push(`🛍 *${item.product_name}* - ₹${item.unit_price} x ${item.unit_quantity}`);

                    // Calculate total price
                    totalAmount += (item.unit_price * item.unit_quantity) + item.tax_amount;
                }


                const message = `🎉 *Order Confirmed!* \n\nThank you for shopping with *Oncomart*! 🛒\n\n✅ Your order has been successfully placed.\n\n🛍 *Order Details:* \n${items.join("\n")}\n\n🚚 We will share tracking details soon.\n📦 Stay tuned for updates!\n\nHappy Shopping! 😊`;

                console.log("Order confirmation message:", message);

                if (!userExists[0]?.mobile) {
                    console.error("Error: Customer phone number not found.");
                    return res.status(400).json({ error: "Customer phone number is missing." });
                }

                console.log("Sending message to:", userExists[0].mobile);

                const data = await sendMessage({
                    mobile: userExists[0].mobile,
                    msg: message
                });

                console.log("Message sent response:", data);

                return res.status(201).json({ message: 'Order created successfully.', orderPlaced });

            } catch (error) {
                console.error("Error creating order:", error);
                return res.status(500).json({ error: "Internal Server Error" });
            }

        }


    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'An error occurred while creating the order.', error: error.message });
    }
}

exports.VerifyPaymentOrder = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing required payment details.',
            });
        }

        const data = { razorpay_payment_id, razorpay_order_id, razorpay_signature };

        const verifyPayment = new PaymentVerification();
        const orderCheck = await verifyPayment.verifyPayment(data);

        if (!orderCheck) {
            return res.status(403).json({
                success: false,
                redirect: 'failed_screen',
                message: 'Payment Failed',
            });
        }

        const findOrderQuery = `SELECT * FROM cp_order_temp WHERE razorpayOrderID = ?`;
        const [order] = await pool.execute(findOrderQuery, [razorpay_order_id]);

        if (order.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Order not found.',
            });
        }

        const tempOrder = order[0];

        const updateOrderQuery = `
            UPDATE cp_order_temp
            SET payment_status = ?, transaction_number = ?
            WHERE razorpayOrderID = ?
        `;
        await pool.execute(updateOrderQuery, ['Paid', razorpay_payment_id, razorpay_order_id]);

        const copyOrderQuery = `
            INSERT INTO cp_order (
                order_date, razorpayOrderID, customer_id, prescription_id, hospital_name, doctor_name, prescription_notes,
                customer_name, customer_email, customer_phone, customer_address, customer_pincode,
                customer_shipping_name, customer_shipping_phone, customer_shipping_address, customer_shipping_pincode,
                amount, subtotal, order_gst, coupon_code, coupon_discount, shipping_charge, additional_charge,
                payment_mode, payment_option, status, payment_status, transaction_number
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const orderValues = [
            tempOrder.order_date,
            tempOrder.razorpayOrderID,
            tempOrder.customer_id,
            tempOrder.prescription_id,
            tempOrder.hospital_name,
            tempOrder.doctor_name,
            tempOrder.prescription_notes,
            tempOrder.customer_name,
            tempOrder.customer_email,
            tempOrder.customer_phone,
            tempOrder.customer_address,
            tempOrder.customer_pincode,
            tempOrder.customer_shipping_name,
            tempOrder.customer_shipping_phone,
            tempOrder.customer_shipping_address,
            tempOrder.customer_shipping_pincode,
            tempOrder.amount,
            tempOrder.subtotal,
            tempOrder.order_gst,
            tempOrder.coupon_code,
            tempOrder.coupon_discount,
            tempOrder.shipping_charge,
            tempOrder.additional_charge,
            tempOrder.payment_mode,
            tempOrder.payment_option,
            'Pending',
            'Paid',
            razorpay_payment_id,
        ];

        const [insertResult] = await pool.execute(copyOrderQuery, orderValues);
        const newOrderId = insertResult.insertId;

        if (!newOrderId) {
            throw new Error('Failed to retrieve newOrderId');
        }

        const updateProductOrderQuery = `
            UPDATE cp_order_details 
            SET order_id = ? 
            WHERE order_id = ?
        `;
        await pool.execute(updateProductOrderQuery, [newOrderId, tempOrder?.order_id]);


        const order_details_after = await find_Details_Order(tempOrder?.razorpayOrderID)

        if (!order_details_after) {
            return res.status(404).json({ message: 'Failed to retrieve order details' });
        }


        //make a bill receipt using 
        const html_page = `<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f0f7ff;">
    <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <tr>
            <td style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%); border-radius: 12px;">
                <img src="https://i.ibb.co/kSpzZn4/onco-health-mart-logo.png" alt="Onco Health Mart Logo" style="max-width: 250px; filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.2));">
            </td>
        </tr>
        
        <tr>
            <td style="padding: 30px 20px;">
                <div style="background: linear-gradient(135deg, #f6f9ff 0%, #f1f6ff 100%); border: 1px solid #e0e9ff; border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <h2 style="color: #1e3c72; margin: 0 0 15px 0; font-size: 24px; border-bottom: 2px solid #2a5298; padding-bottom: 10px;">Order Confirmation</h2>
                    <p style="margin: 8px 0; color: #2a5298; font-size: 16px;">Order ID: <span style="color: #4a6fa5; font-weight: 500;">${order_details_after?.transaction_number}</span></p>
                    <p style="margin: 8px 0; color: #2a5298; font-size: 16px;">Date: <span style="color: #4a6fa5; font-weight: 500;">${new Date(order_details_after?.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
                    <p style="margin: 8px 0; font-size: 16px;"><span style="background-color: #4CAF50; color: white; padding: 5px 12px; border-radius: 20px; font-size: 14px;">✓ ${order_details_after?.status}</span></p>
                </div>

                <div style="background: linear-gradient(135deg, #f6f9ff 0%, #f1f6ff 100%); border: 1px solid #e0e9ff; border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <h3 style="color: #1e3c72; margin: 0 0 15px 0; font-size: 20px;">📍 Shipping Details</h3>
                    <p style="margin: 8px 0; color: #4a6fa5; line-height: 1.6;">
                        <strong style="color: #2a5298; font-size: 18px;">${order_details_after?.customer_shipping_name}</strong><br>
                        ${order_details_after?.customer_shipping_address}<br>
                        PIN: ${order_details_after?.customer_shipping_pincode}<br>
                        📱 Phone: ${order_details_after?.customer_shipping_phone}
                    </p>
                </div>

                <div style="background: linear-gradient(135deg, #f6f9ff 0%, #f1f6ff 100%); border: 1px solid #e0e9ff; border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <h3 style="color: #1e3c72; margin: 0 0 15px 0; font-size: 20px;">🛍️ Order Details</h3>
                    <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                        <tr style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);">
                            <th style="padding: 12px; text-align: left; color: white; border-radius: 8px 0 0 0;">Product</th>
                            <th style="padding: 12px; text-align: right; color: white;">Quantity</th>
                            <th style="padding: 12px; text-align: right; color: white; border-radius: 0 8px 0 0;">Price</th>
                        </tr>
                        ${order_details_after?.details.map(item => `
                        <tr style="background-color: white;">
                            <td style="padding: 12px; border-bottom: 1px solid #e0e9ff; color: #2a5298;">${item.product_name}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e0e9ff; color: #4a6fa5;">${item.unit_quantity}</td>
                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e0e9ff; color: #4a6fa5;">₹${item.unit_price.toFixed(2)}</td>
                        </tr>
                        `).join('')}
                    </table>
                </div>

                <div style="background: linear-gradient(135deg, #f6f9ff 0%, #f1f6ff 100%); border: 1px solid #e0e9ff; border-radius: 12px; padding: 20px; margin-bottom: 25px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <table cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                            <td style="padding: 8px 0; color: #2a5298;">Subtotal:</td>
                            <td style="text-align: right; color: #4a6fa5;">₹${order_details_after?.subtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #2a5298;">Shipping:</td>
                            <td style="text-align: right; color: #4a6fa5;">₹${order_details_after?.shipping_charge.toFixed(2)}</td>
                        </tr>
                        ${order_details_after?.coupon_discount ? `
                        <tr>
                            <td style="padding: 8px 0; color: #2a5298;">Discount (${order_details_after.coupon_code}):</td>
                            <td style="text-align: right; color: #4CAF50;">-₹${order_details_after.coupon_discount.toFixed(2)}</td>
                        </tr>
                        ` : ''}
                        <tr style="font-weight: bold; font-size: 18px;">
                            <td style="padding: 15px 0; border-top: 2px solid #2a5298; color: #1e3c72;">Total:</td>
                            <td style="text-align: right; padding: 15px 0; border-top: 2px solid #2a5298; color: #1e3c72;">₹${order_details_after?.amount.toFixed(2)}</td>
                        </tr>
                    </table>
                </div>

                <div style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); border-radius: 12px; color: white;">
                    <p style="margin: 5px 0;">💳 Payment Method: ${order_details_after?.payment_mode}</p>
                </div>

                <div style="margin-top: 30px; text-align: center; background: linear-gradient(135deg, #f6f9ff 0%, #f1f6ff 100%); padding: 20px; border-radius: 12px;">
                    <h3 style="color: #1e3c72; margin: 0 0 10px 0;">Thank you for shopping with Onco Health Mart! ❤️</h3>
                    <p style="color: #4a6fa5; margin: 0;">If you have any questions, please contact our customer service.</p>
                </div>
            </td>
        </tr>
    </table>
        </body>`


        const message = `🛒 *Order Confirmation*\n\n📌 *Order ID:* ${order_details_after?.transaction_number}\n📅 *Date:* ${new Date(order_details_after?.order_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n✅ *Status:* ${order_details_after?.status}\n\n📍 *Shipping Details:*\n👤 *Name:* ${order_details_after?.customer_shipping_name}\n🏠 *Address:* ${order_details_after?.customer_shipping_address}\n📮 *PIN:* ${order_details_after?.customer_shipping_pincode}\n📞 *Phone:* ${order_details_after?.customer_shipping_phone}\n\n🛍️ *Order Details:*\n${order_details_after?.details.map(item => `🔹 *${item.product_name}*\n   - Quantity: ${item.unit_quantity}\n   - Price: ₹${item.unit_price.toFixed(2)}`).join('\n')}\n\n💰 *Payment Summary:*\n💵 *Subtotal:* ₹${order_details_after?.subtotal.toFixed(2)}\n🚚 *Shipping:* ₹${order_details_after?.shipping_charge.toFixed(2)}\n${order_details_after?.coupon_discount ? `🎟️ *Discount (${order_details_after.coupon_code}):* -₹${order_details_after.coupon_discount.toFixed(2)}` : ''}\n💳 *Total:* ₹${order_details_after?.amount.toFixed(2)}\n\n💳 *Payment Method:* ${order_details_after?.payment_mode}\n\n🙏 *Thank you for shopping with Onco Health Mart! ❤️*\n📞 For any queries, contact our customer service.`

        console.log("Order confirmation message:", message);


        const dataSend = await sendMessage({
            mobile: order_details_after?.customer_shipping_phone,
            msg: message
        });

        console.log("Message sent response:", dataSend);


        const deleteTempOrderQuery = `DELETE FROM cp_order_temp WHERE razorpayOrderID = ?`;
        await pool.execute(deleteTempOrderQuery, [razorpay_order_id]);


        const mail_options = {
            from: 'Onco Health Mart <noreply@oncohealthmart.com>',
            to: order_details_after?.customer_email,
            subject: 'Order Confirmation',
            html: html_page,

        };

        await sendEmail(mail_options);

        return res.status(200).json({
            success: true,
            redirect: 'success_screen',
            message: 'Payment verified and order processed successfully.',
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while verifying payment.',
            error: error.message,
        });
    }
};

async function find_Details_Order(razorpay_order_id) {
    try {
        // Fetch the first order matching the razorpayOrderID
        const sqlQuery = `SELECT * FROM cp_order WHERE razorpayOrderID = ? LIMIT 1`;
        const [orders] = await pool.execute(sqlQuery, [razorpay_order_id]);

        if (orders.length === 0) {
            throw new Error('Order not found');
        }


        const order = orders[0];


        const orderDetailsSql = `SELECT * FROM cp_order_details WHERE order_id = ?`;
        const [orderDetails] = await pool.execute(orderDetailsSql, [order.order_id]);


        order.details = orderDetails;

        console.log("i am bond", order)
        return order
    } catch (error) {
        console.error('Error fetching order details:', error);
        return error
    }
}





exports.checkCouponCode = async (req, res) => {
    try {
        const { couponCode, ProductsFromCart, totalPrice } = req.body;

        // Validate request
        if (!couponCode) {
            return res.status(400).json({
                success: false,
                message: "Coupon code is required."
            });
        }

        if (!ProductsFromCart || !Array.isArray(ProductsFromCart) || ProductsFromCart.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart is empty or invalid."
            });
        }

        if (!totalPrice || totalPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid total price."
            });
        }

        // Fetch coupon details from the database
        const [couponDetails] = await pool.query(
            "SELECT * FROM cp_app_offer WHERE CODE = ? ",
            [couponCode]
        );

        if (!couponDetails || couponDetails.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Invalid or expired coupon code."
            });
        }

        const coupon = couponDetails[0];

        // Check minimum order value eligibility
        if (totalPrice < coupon.min_order_value) {
            return res.status(400).json({
                success: false,
                message: `Coupon is not applicable. Minimum order value required is ₹${coupon.min_order_value}.`
            });
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discount_type === "Amount") {
            discount = Math.min(coupon.maxDiscount, coupon.discount_amount || 0);
        } else if (coupon.discount_type === "Percentage") {
            discount = Math.min(
                Math.ceil((coupon.percenatge_off / 100) * totalPrice)
            );
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid discount type in coupon."
            });
        }

        if (discount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Coupon does not provide any discount for the current cart."
            });
        }

        const grandTotal = totalPrice - discount;

        // Return success response
        return res.status(200).json({
            success: true,
            message: `Coupon applied successfully! You saved ₹${discount}.`,
            discount: discount,
            grandTotal: grandTotal
        });
    } catch (error) {
        console.error("Error applying coupon:", error);
        return res.status(500).json({
            success: false,
            message: "An error occurred while applying the coupon. Please try again later."
        });
    }
};




exports.Create_repeat_Order = async (req, res) => {

    try {
        const re_order = req.params.id

        const userId = req.user?.id?.customer_id;


        if (!userId) {
            return res.status(400).json({ message: 'Please log in to complete the order.' });
        }


        const checkUserSql = `SELECT * FROM cp_customer WHERE customer_id = ?`;
        const [userExists] = await pool.execute(checkUserSql, [userId]);
        if (userExists.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const findPastOrder = `SELECT * FROM cp_order WHERE order_id = ?`;
        const [order_check] = await pool.execute(findPastOrder, [re_order]);
        if (order_check.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const cart = order_check[0] || {};

        if (!cart?.order_id) {
            throw new Error('Order ID not found. Please check the cart details.');
        }

        const orderDetailsSql = `SELECT * FROM cp_order_details WHERE order_id = ?`;
        const [orderDetails] = await pool.execute(orderDetailsSql, [cart?.order_id]);


        // console.log("userId id",orderDetails)
        if (!orderDetails || orderDetails.length === 0) {
            return res.status(400).json({ message: 'Product details are required.' });
        }




        const shippingCharge = cart?.totalPrice > 1500 ? 0 : 200;

        const Order = {
            order_date: new Date(),
            orderFrom: 'Application',
            customer_id: userExists[0]?.customer_id,
            prescription_id: cart?.prescription_id || '',
            hospital_name: cart?.hospital_name || '',
            doctor_name: cart?.doctor_name || '',
            prescription_notes: cart?.prescription_notes || '',
            customer_name: cart?.customer_name,
            customer_email: userExists[0]?.email_id,
            customer_phone: cart?.customer_phone,
            customer_address: cart?.customer_address,
            customer_pincode: cart?.customer_pincode,
            customer_shipping_name: cart?.customer_shipping_name,
            customer_shipping_phone: cart?.customer_shipping_phone,
            customer_shipping_address: cart?.customer_shipping_address,
            customer_shipping_pincode: cart?.customer_shipping_pincode,
            amount: cart?.amount,
            subtotal: cart?.subtotal,
            order_gst: '',
            coupon_code: cart?.coupon_code || '',
            coupon_discount: cart?.coupon_discount || 0,
            shipping_charge: cart?.shipping_charge,
            additional_charge: 0,
            payment_mode: cart?.payment_mode,
            payment_option: cart?.payment_option || 'Online',
            status: 'Pending',
        };



        const ProductInOrder = orderDetails.map((item) => ({
            product_id: item?.product_id,
            product_name: item?.product_name,
            product_image: item?.product_image,
            unit_price: item?.unit_price,
            unit_quantity: item?.unit_quantity,
            tax_percent: item?.tax_percent || 0,
            tax_amount: item?.tax_amount || 0,
        }));

        console.log("ProductInOrder:", ProductInOrder);

        const sqlOrderDetails = `
        INSERT INTO cp_order_details 
        (order_id, product_id, product_name, product_image, unit_price, unit_quantity, tax_percent, tax_amount) 
        VALUES (?,?,?,?,?,?,?,?)`;

        const saveOrderSql = `
       INSERT INTO cp_order (
           order_date,orderFrom, customer_id, prescription_id, hospital_name, doctor_name, prescription_notes,
           customer_name, customer_email, customer_phone, customer_address, customer_pincode,
           customer_shipping_name, customer_shipping_phone, customer_shipping_address, customer_shipping_pincode,
           amount, subtotal, order_gst, coupon_code, coupon_discount, shipping_charge, additional_charge,
           payment_mode, payment_option, status
       ) VALUES (
           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?
       )`;

        const saveOrderInTemp = `
       INSERT INTO cp_order_temp (
           order_date,razorpayOrderID,orderFrom, customer_id, prescription_id, hospital_name, doctor_name, prescription_notes,
           customer_name, customer_email, customer_phone, customer_address, customer_pincode,
           customer_shipping_name, customer_shipping_phone, customer_shipping_address, customer_shipping_pincode,
           amount, subtotal, order_gst, coupon_code, coupon_discount, shipping_charge, additional_charge,
           payment_mode, payment_option, status
       ) VALUES (
           ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?
       )`;



        const orderValues = Object.values(Order);
        const razarpay = new CreateOrderRazorpay()
        if (cart?.payment_option === 'Online') {
            const amount = cart?.amount
            const sendOrder = await razarpay.createOrder(amount)
            const TemOrder = {
                order_date: new Date(),
                razorpayOrderID: sendOrder.id,
                orderFrom: 'Application',
                customer_id: userExists[0]?.customer_id,
                prescription_id: cart?.prescription_id || '',
                hospital_name: cart?.hospital_name || '',
                doctor_name: cart?.doctor_name || '',
                prescription_notes: cart?.prescription_notes || '',
                customer_name: cart?.customer_name,
                customer_email: userExists[0]?.email_id,
                customer_phone: cart?.customer_phone,
                customer_address: cart?.customer_address,
                customer_pincode: cart?.customer_pincode,
                customer_shipping_name: cart?.customer_shipping_name,
                customer_shipping_phone: cart?.customer_shipping_phone,
                customer_shipping_address: cart?.customer_shipping_address,
                customer_shipping_pincode: cart?.customer_shipping_pincode,
                amount: cart?.amount,
                subtotal: cart?.subtotal,
                order_gst: '',
                coupon_code: cart?.coupon_code || '',
                coupon_discount: cart?.coupon_discount || 0,
                shipping_charge: cart?.shipping_charge,
                additional_charge: 0,
                payment_mode: cart?.payment_mode,
                payment_option: cart?.payment_option || 'Online',
                status: 'Pending',
            };

            const orderValuesTemp = Object.values(TemOrder);


            const saveOrder = await pool.execute(saveOrderInTemp, orderValuesTemp);

            for (const item of ProductInOrder) {
                const orderDetailsValues = [
                    saveOrder[0].insertId,
                    item.product_id,
                    item.product_name,
                    item.product_image,
                    item.unit_price,
                    item.unit_quantity,
                    item.tax_percent,
                    item.tax_amount
                ];
                try {

                    const deatils = await pool.execute(sqlOrderDetails, orderDetailsValues);
                    console.log("deatils", deatils)
                } catch (error) {
                    console.error('Error inserting product:', error);
                }
            }


            return res.status(201).json({ message: 'Order created successfully.Please Pay !!!', sendOrder });
        } else {
            const orderPlaced = await pool.execute(saveOrderSql, orderValues);
            for (const item of ProductInOrder) {
                const orderDetailsValues = [
                    orderPlaced[0].insertId,
                    item.product_id,
                    item.product_name,
                    item.product_image,
                    item.unit_price,
                    item.unit_quantity,
                    item.tax_percent,
                    item.tax_amount
                ];
                console.log("orderDetailsValues:", orderDetailsValues);
                try {

                    const deatils = await pool.execute(sqlOrderDetails, orderDetailsValues);

                } catch (error) {
                    console.error('Error inserting product:', error);
                }
            }
            return res.status(201).json({ message: 'Order created successfully.', orderPlaced })
        }


    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'An error occurred while creating the order.', error: error.message });
    }
}



//admin
exports.get_all_order = async (req, res) => {
    try {
        const redis = req.app.locals?.redis;

        if (!redis) {
            return res.status(500).json({ success: false, message: 'Redis client not available' });
        }

        // Fetch orders from the database
        const orders = await fetchOrdersFromDatabase();
        if (!orders.length) {
            return res.status(404).json({ success: false, message: 'No orders found' });
        }

        // Extract order IDs for fetching details
        const orderIds = orders.map(order => order.order_id);

        // Fetch order details with pagination
        const orderDetails = await fetchOrderDetails(orderIds, req.query.search_query);

        // Map order details by order ID
        const orderDetailsMap = mapOrderDetailsById(orderDetails);

        // Merge orders with details
        const updatedOrders = mergeOrdersWithDetails(orders, orderDetailsMap);

        // Cache the result in Redis
        redis.setex('ordersCache', 3600, JSON.stringify(updatedOrders));

        return res.status(200).json({
            success: true,
            message: 'Orders fetched successfully',
            data: updatedOrders,
            totalOrders: orders.length,
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Function to fetch orders from the database
async function fetchOrdersFromDatabase() {
    const sqlQuery = 'SELECT * FROM cp_order WHERE 1=1';
    const [orders] = await pool.execute(sqlQuery);
    return orders;
}

// Function to fetch order details with pagination
async function fetchOrderDetails(orderIds) {
    const orderDetailsLimit = 1000;
    const batchSize = Math.ceil(orderIds.length / orderDetailsLimit);

    const orderDetails = [];

    for (let i = 0; i < batchSize; i++) {
        const batchOrderIds = orderIds.slice(i * orderDetailsLimit, (i + 1) * orderDetailsLimit);

        // Log batchOrderIds to see which IDs are being processed
        console.log(`Batch ${i + 1} of ${batchSize}: `, batchOrderIds);

        // Prepare the SQL query
        let orderDetailsSql = 'SELECT * FROM cp_order_details WHERE order_id IN (?)';
        console.log(`Executing SQL Query: `, orderDetailsSql);

        // Log the parameters being passed to the query
        console.log(`Query Parameters: `, [batchOrderIds]);

        try {
            const [batchOrderDetails] = await pool.execute(orderDetailsSql, [batchOrderIds]);

            // Log the result to see the order details returned from the database
            console.log(`Batch ${i + 1} Result: `, batchOrderDetails);

            // Push the result into the orderDetails array
            orderDetails.push(...batchOrderDetails);

        } catch (error) {
            console.error(`Error executing query for Batch ${i + 1}:`, error);
        }
    }

    // Final result log
    console.log('All Order Details: ', orderDetails);

    return orderDetails;
}


// Function to map order details by order ID
function mapOrderDetailsById(orderDetails) {
    return orderDetails.reduce((map, detail) => {
        map[detail.order_id] = map[detail.order_id] || [];
        map[detail.order_id].push(detail);
        return map;
    }, {});
}

// Function to merge orders with their details
function mergeOrdersWithDetails(orders, orderDetailsMap) {
    return orders.map(order => ({
        ...order,
        details: orderDetailsMap[order.order_id] || [],
    }));
}

