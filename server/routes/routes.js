const express = require('express');
const multer = require('multer')
const { register, VerifyOtp, login, logout, forgotPassword, updateDetails, getMyProfile, resendOtp, PrsecRegister } = require('../Controller/user.controller');
const { Protect } = require('../Middleware/Protect');
const { getAllCategory, GetAllProduct, getSingleProduct, GetAllActiveBanners, GetContentOfPage, getSearchByInput, getReviews, getNews } = require('../Controller/get.controller');
const { GetMyOrder, UploadPrescription, checkCouponCode, CreateOrder, VerifyPaymentOrder, Create_repeat_Order, get_all_order } = require('../Controller/Order.controller');
const { addNewAddress, getMyAddresses, updateMyAddress, deleteMyAddress, check_area_availability, getAllAddresses, updateAnyAddress, deleteAnyAddress, getSingleAddresses } = require('../Controller/address.controller');
const { FindAllCoupons, createCoupon, getAllCoupons, getSingleCoupon, updateCoupon, deleteCoupon } = require('../Controller/Coupons.Controller');
const { upload_prescriptions, get_my_uploaded_presc, getAllPrescriptions, getPrescriptionById, deletePrescriptionById } = require('../Controller/Prescriptions');
const { CreateHotDeals, GetAllDeals, DeleteDeal, UpdateDeal, GetSingleDealById } = require('../Controller/HotDeals');
const { getSetting } = require('../Controller/settings.controller');
const { createNews, updateNews, deleteNews } = require('../Controller/News.controller');
const router = express.Router()
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});


// User routes
router.post('/register-user', register)
router.post('/register-prescribe_user', PrsecRegister)
router.post('/otp-user-verify', VerifyOtp)
router.post('/user-login', login)
router.post('/resend-otp', resendOtp)

router.post('/user-logout', Protect, logout)
router.post('/user-update', Protect, updateDetails)
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

// Orders Via Prescription
router.post('/upload', upload.array('prescription', 5), Protect, upload_prescriptions);
router.get('/get-my-presc', Protect, get_my_uploaded_presc);

//Area Avaailablity 
router.get('/check_coupons', FindAllCoupons)


//Area Avaailablity 
router.post('/check_area_availability', check_area_availability)
// Orders
router.post('/make-a-order', Protect, upload.single('file'), CreateOrder)
router.post('/repeat_order/:id', Protect, Create_repeat_Order)
router.post('/verify-payment', VerifyPaymentOrder)

// Fetch Setting
router.get('/fetch-settings', getSetting)


// Hot deals

router.post('/create-hot-deals', upload.single('file'), CreateHotDeals)
router.get('/get-hot-deals', GetAllDeals)
router.get('/get-hot-deal', GetSingleDealById)
router.delete('/delete-hot-deals', DeleteDeal)
router.put('/update-hot-deals', upload.single('file'), UpdateDeal)





// ============================ADMIN ROUTES ============================ //
router.get('/get-all-adresses', getAllAddresses)
router.put('/update-any-adresses/:addressId', updateAnyAddress)
router.delete('/delete-any-adresses/:addressId', deleteAnyAddress)
router.get('/get-any-adresss/:addressId', getSingleAddresses)


router.post('/coupons', createCoupon);
router.get('/coupons', getAllCoupons);
router.get('/coupons/:couponId', getSingleCoupon);
router.put('/coupons/:couponId', updateCoupon);
router.delete('/coupons/:couponId', deleteCoupon);




router.post('/news', createNews);
router.put('/news/:newsId', updateNews);
router.delete('/news/:newsId', deleteNews);



router.get("/prescriptions", getAllPrescriptions);
router.get("/prescriptions/:id", getPrescriptionById);
router.delete("/prescriptions/:id", deletePrescriptionById);





module.exports = router;