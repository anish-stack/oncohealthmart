const express = require('express');
const multer = require('multer')
const { register, VerifyOtp, login, logout, forgotPassword, updateDetails, getMyProfile, resendOtp } = require('../Controller/user.controller');
const { Protect } = require('../Middleware/Protect');
const { getAllCategory, GetAllProduct, getSingleProduct, GetAllActiveBanners, GetContentOfPage, getSearchByInput, getReviews, getNews } = require('../Controller/get.controller');
const { GetMyOrder, UploadPrescription, checkCouponCode, CreateOrder, VerifyPaymentOrder, Create_repeat_Order, get_all_order } = require('../Controller/Order.controller');
const { addNewAddress, getMyAddresses, updateMyAddress, deleteMyAddress, check_area_availability } = require('../Controller/address.controller');
const { FindAllCoupons } = require('../Controller/Coupons.Controller');
const router = express.Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});


// User routes
router.post('/register-user', register)
router.post('/otp-user-verify', VerifyOtp)
router.post('/user-login', login)
router.post('/resend-otp', resendOtp)

router.post('/user-logout', Protect, logout)
router.patch('/user-update', Protect, updateDetails)
router.post('/forget-password', forgotPassword)
router.get('/my-profile', Protect, getMyProfile)


//Category routes
router.get('/get-Category', getAllCategory)
//Product  routes
router.get('/get-products', GetAllProduct)
router.get('/get-product/:productId', getSingleProduct)
// Banners
router.get('/get-all-active-banner', GetAllActiveBanners)
//GetContentOfPage
router.get('/get-content', GetContentOfPage)

//Order routes
router.get('/get-my-order', Protect, GetMyOrder)
router.get('/get-all-order', get_all_order)

router.post('/apply-coupon_code', checkCouponCode)

//Address routes
router.post('/add-new-address', Protect, addNewAddress)
router.get('/get-my-address', Protect, getMyAddresses)
router.post('/update-my-address/:addressId', Protect, updateMyAddress)
router.delete('/delete-my-address/:addressId', Protect, deleteMyAddress)


//Upload  Presciptions
router.post('/Upload-Prescription', upload.single('file'), UploadPrescription)
router.get('/getSearchByInput', getSearchByInput)

//reviews
router.get('/getReviews', getReviews)
router.get('/getNews', getNews)


//Area Avaailablity 
router.get('/check_coupons', FindAllCoupons)


//Area Avaailablity 
router.post('/check_area_availability', check_area_availability)
// Orders
router.post('/make-a-order', Protect, upload.single('file'), CreateOrder)
router.post('/repeat_order/:id', Protect, Create_repeat_Order)
router.post('/verify-payment', VerifyPaymentOrder)

module.exports = router;