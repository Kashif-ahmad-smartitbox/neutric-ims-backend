const jwt = require('jsonwebtoken');
const User = require('../models/User');



exports.protect = async (req, res, next) => {
    let token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-pswd');
        
        // Check if user account is blacklisted
        if (user.accountStatus === 'blacklisted') {
            return res.status(401).json({ message: 'Your account is blacklisted. Please contact support.' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token invalid or expired' });
    }
};

// Role-Based Access
exports.authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};
