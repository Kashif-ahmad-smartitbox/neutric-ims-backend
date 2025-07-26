const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  pswd: { type: String, required: true },
  role: {
    type: String,
    enum: [
      'admin',
      'junior site engineer',
      'site engineer',
      'site store incharge',
      'center store incharge',
      'purchase manager',
      'purchase VP',
      'accounts officer',
      'security guard',
    ],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    default: null,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  lastPasswordResetRequest: { type: Date, default: null },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('pswd')) return next();
    const salt = await bcrypt.genSalt(10);
    this.pswd = await bcrypt.hash(this.pswd, salt);
    next();
});

module.exports = mongoose.model('User', userSchema);