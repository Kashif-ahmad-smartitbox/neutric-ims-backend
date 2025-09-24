const express = require('express');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Site = require('../models/Site');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// Generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

const generateRefreshToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d',
  });
};

router.post('/add-user',protect ,  async (req, res) => {
  const { name, email, mobile, username, password, role, site } = req.body;
  try {
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const userData = {
      name,
      email,
      mobile,
      username,
      pswd: password,
      role,
    };

    if (site) {
      const siteExists = await Site.findById(site);
      if (!siteExists) {
        return res.status(400).json({ success: false, message: 'Invalid site' });
      }
      userData.site = site;
    }

    const user = await User.create(userData);
    res.status(201).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          username: user.username,
          role: user.role,
          status: user.status,
          site: user.site,
        },
      },
      message: 'User added successfully',
    });
  } catch (error) {
    console.error('Error adding user:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login User
router.post('/login', async (req, res) => {
  const { login, pswd } = req.body;
  console.log(login, pswd);
  try {
    const user = await User.findOne({
      $or: [{ email: login }, { username: login }],
    }).populate('site');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email/username or password' });
    }
    if (user.status === 'inactive') {
      return res.status(400).json({ success: false, message: 'Your account is inactive. Please contact support.' });
    }
    const isMatch = await bcrypt.compare(pswd, user.pswd);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email/username or password' });
    }
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          username: user.username,
          role: user.role,
          status: user.status,
          site: user.site,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Error in login:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get All Users
router.get('/get-all-users',  async (req, res) => {
  try {
    const users = await User.find().populate('site').sort({ createdAt: -1 });
    res.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update User
router.put('/update-user/:userId',  async (req, res) => {
  const { userId } = req.params;
  // accept both `password` (frontend) and `pswd` (legacy)
  const { name, email, mobile, username, pswd, password, role, site } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // update simple fields on the document so that pre-save hook can run when password changes
    user.name = name || user.name;
    user.email = email || user.email;
    user.mobile = mobile || user.mobile;
    user.username = username || user.username;
    user.role = role || user.role;

    // handle password: frontend sends `password`; some parts may send `pswd`
    const newPassword = password || pswd;
    if (newPassword) {
      // assign to pswd so pre('save') hook hashes it
      user.pswd = newPassword;
    }

    if (site) {
      const siteExists = await Site.findById(site);
      if (!siteExists) {
        return res.status(400).json({ success: false, message: 'Invalid site' });
      }
      user.site = site;
    } else if (site === '') {
      user.site = null;
    }

    const updatedUser = await user.save();
    await updatedUser.populate('site');

    res.status(200).json({
      success: true,
      data: { user: updatedUser },
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Error updating user:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete Users
router.post('/delete-users',  async (req, res) => {
  const { userIds } = req.body;
  try {
    const result = await User.deleteMany({ _id: { $in: userIds } });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'No users found to delete' });
    }
    res.status(200).json({ success: true, message: 'Users deleted successfully' });
  } catch (error) {
    console.error('Error deleting users:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Toggle User Status
router.put('/toggle-status/:userId',  async (req, res) => {
  const { userId } = req.params;
  const { status } = req.body;
  try {
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    ).populate('site');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({
      success: true,
      data: { user },
      message: `User status updated to ${status}`,
    });
  } catch (error) {
    console.error('Error updating user status:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get All Sites
router.get('/get-all-sites',  async (req, res) => {
  try {
    const sites = await Site.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: { sites },
    });
  } catch (error) {
    console.error('Error fetching sites:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }
    if (user.lastPasswordResetRequest) {
      const timeSinceLastRequest =
        Date.now() - new Date(user.lastPasswordResetRequest).getTime();
      const cooldownPeriod = 120000;
      if (timeSinceLastRequest < cooldownPeriod) {
        const remainingTime = Math.ceil((cooldownPeriod - timeSinceLastRequest) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingTime} seconds before requesting another password reset.`,
        });
      }
    }
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 3600000;
    user.lastPasswordResetRequest = Date.now();
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const mailOptions = {
      to: user.email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Please click the following link to reset your password: ${resetUrl}`,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Reset link sent to your email' });
  } catch (error) {
    console.error('Error in forgot password:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  try {
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpire: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }
    user.pswd = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    res.status(200).json({ success: true, message: 'Password successfully updated' });
  } catch (error) {
    console.error('Error in resetting password:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Logout User
router.post('/logout', protect, async (req, res) => {
  try {
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in logout:', error);
    res.status(500).json({ message: 'Server Error: Could not log out' });
  }
});

// Refresh Token
router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  if (!retrieveToken) {
    return res.status(401).json({ message: 'Refresh token missing' });
  }
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }
    const newAccessToken = generateToken(user._id, user.role);
    res.status(200).json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(403).json({ message: 'Invalid refresh token' });
  }
});

// Verify Token
router.get('/protected-route', async (req, res) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-pswd');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.accountStatus === 'blacklisted') {
      return res.status(403).json({ message: 'Account is blacklisted' });
    }

    res.status(200).json({
      message: 'Token is valid',
      user: {
        id: user._id,
        role: user.role,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Verify Token Error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


router.get('/all-sales-executive', async (req, res) => {
  try {
    const salesExecutives = await User.find({ role: 'bdm' }).select('name _id');
    res.json({ success: true, allSaleExecuitve: salesExecutives });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching sales executives' });
  }
});

module.exports = router;