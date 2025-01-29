// models/branch.js
const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: String,
  city: String,
  users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  menuItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Branch = mongoose.model('Branch', branchSchema);

module.exports = Branch;