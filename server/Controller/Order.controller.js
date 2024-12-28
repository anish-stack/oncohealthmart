const pool = require("../Database/db");
const crypto = require('crypto');
const { CreateOrderRazorpay, PaymentVerification } = require("../service/razarpay.service");
const cloudinary = require('cloudinary').v2;




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

        // Sort orders by date
        orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

        // Pagination
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
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
                console.log(JSON.stringify(dataC[0]?.insertId))
                data: JSON.stringify(dataC[0]?.insertId)
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
        if (userExists.length === 0) {
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
        console.log(cart)


        if (!cart?.items || cart?.items.length === 0) {
            return res.status(400).json({ message: 'Product details are required.' });
        }

        if (!address || !address.stree_address || !address.pincode) {
            return res.status(400).json({ message: 'Delivery address is required.' });
        }

        if (!patientName || !patientPhone) {
            return res.status(400).json({ message: 'Patient details are required.' });
        }


        const shippingCharge = cart?.totalPrice > 1500 ? 0 : 200;

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
            additional_charge: 0,
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
                try {

                    const deatils = await pool.execute(sqlOrderDetails, orderDetailsValues);
                    console.log("deatils", deatils)
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
            'Completed',
            'Paid',
            razorpay_payment_id,
        ];

        const [insertResult] = await pool.execute(copyOrderQuery, orderValues);
        const newOrderId = insertResult.insertId; // Correctly access insertId

        if (!newOrderId) {
            throw new Error('Failed to retrieve newOrderId');
        }

        const updateProductOrderQuery = `
            UPDATE cp_order_details 
            SET order_id = ? 
            WHERE order_id = ?
        `;
        await pool.execute(updateProductOrderQuery, [newOrderId, tempOrder?.order_id]);

        const deleteTempOrderQuery = `DELETE FROM cp_order_temp WHERE razorpayOrderID = ?`;
        await pool.execute(deleteTempOrderQuery, [razorpay_order_id]);

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




exports.checkCouponCode = async (req, res) => {
    try {
        const { couponCode, ProductsFromCart, totalPrice } = req.body;

        if (!couponCode) {
            return res.status(400).json({ success: false, message: "Coupon code is required" });
        }

        // Fetch coupon details
        const [couponDetails] = await pool.query(
            "SELECT * FROM cp_coupon WHERE coupon_code = ? ",
            [couponCode]
        );

        if (!couponDetails || couponDetails.length === 0) {
            return res.status(404).json({ success: false, message: "Invalid coupon code" });
        }

        const coupon = couponDetails[0];
        const todayDate = new Date();

        // Check expiration date
        if (coupon.expiry_date && new Date(coupon.expiry_date) < todayDate) {
            return res.status(400).json({ success: false, message: "Coupon has expired" });
        }

        // Check usage limit
        // const [usageCount] = await pool.query(
        //     "SELECT COUNT(*) AS usageCount FROM cp_coupon_usage WHERE coupon_id = ?",
        //     [coupon.coupon_id]
        // );

        // if (coupon.number_of_total_uses > 0 && usageCount[0].usageCount >= coupon.number_of_total_uses) {
        //     return res.status(400).json({ success: false, message: "Coupon usage limit exceeded" });
        // }

        // Get applicable products/categories
        const [couponOptions] = await pool.query(
            "SELECT * FROM cp_coupon_option WHERE coupon_id = ?",
            [coupon.coupon_id]
        );

        let applicableProducts = [];
        if (couponOptions.length > 0) {
            for (let option of couponOptions) {
                if (option.item_type === "Category") {
                    const [products] = await pool.query(
                        "SELECT product_id FROM cp_product WHERE category_id = ?",
                        [option.item_id]
                    );
                    applicableProducts = applicableProducts.concat(products.map(p => p.product_id));
                } else if (option.item_type === "Product") {
                    applicableProducts.push(option.item_id);
                }
            }
        }

        // Calculate discount
        const cartProducts = ProductsFromCart
        let eligiblePrice = 0;

        cartProducts.forEach(product => {
            if (applicableProducts.length === 0 || applicableProducts.includes(product.ProductId)) {
                eligiblePrice += product.Pricing;
            }
        });

        if (eligiblePrice === 0) {
            return res.status(400).json({ success: false, message: "Coupon not applicable to any cart items" });
        }

        let discount = 0;
        if (coupon.discount_type === "Amount") {
            discount = Math.min(coupon.discount_amount, eligiblePrice);
        } else if (coupon.discount_type === "Percentage") {
            discount = Math.ceil((coupon.discount_percentage / 100) * eligiblePrice);
        }

        const grandTotal = totalPrice - discount;


        return res.status(200).json({
            success: true,
            message: "Coupon applied successfully",
            discount: discount,
            grandTotal: grandTotal
        });

    } catch (error) {
        console.error("Error applying coupon:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};


