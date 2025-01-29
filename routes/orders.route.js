const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const { ensureLoggedIn } = require('connect-ensure-login');

// Route to view orders
router.get('/', ensureLoggedIn({ redirectTo: '/auth/login' }), async (req, res) => {
  try {
    // Fetch orders for the logged-in user
    const orders = await Order.find({ user: req.user._id }).populate('items.menuItem');
    
    // Render the orders view and pass the orders
    res.render('orders', { orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Error fetching orders');
  }
});

module.exports = router;


module.exports = router;