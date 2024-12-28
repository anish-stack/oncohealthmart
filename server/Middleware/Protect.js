const jwt = require('jsonwebtoken');

exports.Protect = async (req, res, next) => {
  try {
    
    const token =
      req.cookies.token || req.body.token || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Please Login to Access this',
      });
    }

    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
     
      req.user = decoded; 
      
   
      next(); 
    } catch (error) {
      // Log the specific error for debugging
      console.error('JWT Verification Error:', error.message);
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
      });
    }
 
  } catch (error) {
    // Handle any unexpected errors
    console.error('Internal Server Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
};