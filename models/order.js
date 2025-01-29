const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema for the 'orders' collection
const OrderSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [
    {
      menuItem: {
        type: Schema.Types.ObjectId,
        ref: 'MenuItem',
        required: true
      },
      quantity: {
        type: Number,
        required: true
      }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  __v: {
    type: Number,
    select: false
  }
});

// Create the model from the schema
const Order = mongoose.model('Order', OrderSchema);

module.exports = Order;