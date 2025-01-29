const mongoose = require('mongoose');
const bcrypt = require('bcrypts');
const createHttpError = require('http-errors');
const { roles } = require('../utils/constants');

// Define the User schema
const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: Object.values(roles), default: roles.client },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // Existing field for branch ID
    
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  try {
    if (this.isNew || this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(this.password, salt);
      this.password = hashedPassword;

      // Automatically assign admin role to specified admin email
      if (process.env.ADMIN_EMAIL && this.email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase()) {
        this.role = roles.ADMIN;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check if the password is valid
UserSchema.methods.isValidPassword = async function (password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    throw createHttpError.InternalServerError('Password validation failed.');
  }
};

// Virtual field for a user-friendly role description
UserSchema.virtual('roleDescription').get(function () {
  return this.role.charAt(0).toUpperCase() + this.role.slice(1).toLowerCase();
});

// Static method to get user role counts
UserSchema.statics.getRoleCounts = async function () {
  return this.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $project: { role: '$_id', count: 1, _id: 0 } },
  ]);
};

// Static method to find all admins
UserSchema.statics.findAdmins = function () {
  return this.find({ role: roles.ADMIN });
};

UserSchema.statics.findModerators = function () {
  // Find users with role 'MODERATOR' and populate the `branchId` with the actual `Branch` document
  return this.find({ role: roles.MODERATOR }).populate('branchId');
};

// Register the model in mongoose (check if it's already registered)
const User = mongoose.models.User || mongoose.model('User', UserSchema);

module.exports = User;