const express = require('express');
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const Cart = require('../models/Cart');
const Order = require('../models/order');
const { ensureLoggedIn } = require('connect-ensure-login');
const Branch = require('../models/branch');


const router = express.Router();
// Route to view all menu items for a specific branch
// Route to view all menu items for a specific branch
router.get('/', ensureLoggedIn({ redirectTo: '/auth/login' }), async (req, res) => {
  try {
    const branches = await Branch.find(); // Fetch all branches
    const selectedBranchId = req.query.branch || ''; // Get selected branch ID from query parameters
    let menuItems = [];
    let cartItemsWithQuantity = [];

    if (selectedBranchId) {
      // Ensure the selectedBranchId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(selectedBranchId)) {
        throw new Error('Invalid branch ID');
      }

      // Fetch menu items for the selected branch
      menuItems = await MenuItem.find({ branch: selectedBranchId });

      // Fetch cart items for the current user and selected branch
      const cartItems = await Cart.find({ user: req.user._id, branch: selectedBranchId }).populate('items.menuItem');

      // Combine cart items with their quantities from the Cart model
      cartItemsWithQuantity = cartItems.flatMap(cart =>
        cart.items.map(cartItem => {
          const itemDetails = cartItem.menuItem;

          if (!itemDetails) {
            console.warn(`MenuItem not found for cartItem with ID: ${cartItem.menuItem}`);
            return null; // Return null for missing items
          }

          return { ...itemDetails._doc, quantity: cartItem.quantity }; // Merge item details with quantity
        }).filter(item => item !== null) // Remove null values in case of missing items
      );
    }

    res.render('menu', {
      branches,
      menuItems,
      cartItems: cartItemsWithQuantity,
      branchId: selectedBranchId,
      branchName: branches.find(branch => branch._id.toString() === selectedBranchId)?.name,
      branchCity: branches.find(branch => branch._id.toString() === selectedBranchId)?.city
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).send('Error fetching menu');
  }
});

// Route to add or update items in the cart
router.post('/select', ensureLoggedIn({ redirectTo: '/auth/login' }), async (req, res) => {
  try {
    const { itemId, quantity, branchId } = req.body;
    const quantityToAdd = quantity ? parseInt(quantity, 10) : 1;

    console.log(`Adding item to cart: itemId=${itemId}, quantity=${quantityToAdd}, branchId=${branchId}`);

    // Validate itemId and branchId
    if (!mongoose.Types.ObjectId.isValid(itemId) || !mongoose.Types.ObjectId.isValid(branchId)) {
      req.flash('error', 'Invalid item or branch ID');
      return res.redirect(`/menu?branch=${branchId}`);
    }

    // Find the selected item
    const selectedItem = await MenuItem.findById(itemId);
    if (!selectedItem) {
      req.flash('error', 'Item not found');
      return res.redirect(`/menu?branch=${branchId}`);
    }

    // Find or create the cart for the user and branch
    let cart = await Cart.findOne({ user: req.user._id, branch: branchId });
    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: [],
        branch: branchId
      });
    }

    console.log('Cart found:', cart);

    // Ensure the items array is initialized
    if (!Array.isArray(cart.items)) {
      cart.items = [];
    }

    // Check if the item already exists in the cart
    const existingItemIndex = cart.items.findIndex(item => item.menuItem.toString() === itemId);
    if (existingItemIndex !== -1) {
      // Update the quantity if the item exists
      cart.items[existingItemIndex].quantity += quantityToAdd;
    } else {
      // Add the item to the cart if it doesn't exist
      cart.items.push({
        menuItem: itemId,
        quantity: quantityToAdd
      });
    }

    await cart.save();

    // Increment selectedCount for the menu item
    selectedItem.selectedCount += quantityToAdd;
    await selectedItem.save();

    req.flash('success', 'Item(s) added successfully!');
    res.redirect(`/menu?branch=${branchId}`);
  } catch (error) {
    console.error('Error selecting item:', error);
    req.flash('error', 'Error selecting item');
    res.redirect(`/menu?branch=${req.body.branchId}`); // Ensure branchId is used correctly here
  }
});

// Route to update the quantity of an item in the cart
router.post('/update', ensureLoggedIn({ redirectTo: '/auth/login' }), async (req, res) => {
  try {
    const { itemId, quantity, branchId } = req.body;
    const quantityToUpdate = quantity ? parseInt(quantity, 10) : 1;

    // Validate itemId and branchId
    if (!mongoose.Types.ObjectId.isValid(itemId) || !mongoose.Types.ObjectId.isValid(branchId)) {
      req.flash('error', 'Invalid item or branch ID');
      return res.redirect(`/menu?branch=${branchId}`);
    }

    // Find the cart for the user and branch
    let cart = await Cart.findOne({ user: req.user._id, branch: branchId });
    if (!cart) {
      req.flash('error', 'Cart not found');
      return res.redirect(`/menu?branch=${branchId}`);
    }

    // Check if the item exists in the cart
    const existingItemIndex = cart.items.findIndex(item => item.menuItem.toString() === itemId);
    if (existingItemIndex !== -1) {
      // Update the quantity if the item exists
      cart.items[existingItemIndex].quantity = quantityToUpdate;
      await cart.save();

      req.flash('success', 'Item quantity updated successfully!');
    } else {
      req.flash('error', 'Item not found in the cart');
    }

    res.redirect(`/menu?branch=${branchId}`);
  } catch (error) {
    console.error('Error updating item quantity:', error);
    req.flash('error', 'Error updating item quantity');
    res.redirect(`/menu?branch=${req.body.branchId}`);
  }
});

// Route to remove an item from the cart
router.post('/remove', ensureLoggedIn({ redirectTo: '/auth/login' }), async (req, res) => {
  try {
    const { itemId, branchId } = req.body;

    // Validate itemId and branchId
    if (!mongoose.Types.ObjectId.isValid(itemId) || !mongoose.Types.ObjectId.isValid(branchId)) {
      req.flash('error', 'Invalid item or branch ID');
      return res.redirect(`/menu?branch=${branchId}`);
    }

    // Find the cart for the user and branch
    let cart = await Cart.findOne({ user: req.user._id, branch: branchId });
    if (!cart) {
      req.flash('error', 'Cart not found');
      return res.redirect(`/menu?branch=${branchId}`);
    }

    // Remove the item from the cart
    cart.items = cart.items.filter(item => item.menuItem.toString() !== itemId);
    await cart.save();

    req.flash('success', 'Item removed successfully!');
    res.redirect(`/menu?branch=${branchId}`);
  } catch (error) {
    console.error('Error removing item:', error);
    req.flash('error', 'Error removing item');
    res.redirect(`/menu?branch=${req.body.branchId}`);
  }
});

// Checkout route
router.post('/checkout', ensureLoggedIn({ redirectTo: '/auth/login' }), async (req, res) => {
  try {
    const { branchId } = req.body;
    const cart = await Cart.findOne({ user: req.user._id, branch: branchId }).populate('items.menuItem');

    if (!cart || cart.items.length === 0) {
      req.flash('error', 'Your cart is empty.');
      return res.redirect(`/menu?branch=${branchId}`);
    }

    // Calculate the total amount
    const totalAmount = cart.items.reduce((total, cartItem) => {
      return total + (cartItem.menuItem.price * cartItem.quantity);
    }, 0);

    // Create a new order
    const order = new Order({
      user: req.user._id,
      items: cart.items.map(cartItem => ({
        menuItem: cartItem.menuItem._id,
        quantity: cartItem.quantity
      })),
      totalAmount,
      branch: branchId
    });
    await order.save();

    // Clear the cart
    await Cart.deleteOne({ user: req.user._id, branch: branchId });

    req.flash('success', 'Order placed successfully!');
    res.redirect(`/menu?branch=${branchId}`);
  } catch (error) {
    console.error('Error during checkout:', error);
    req.flash('error', 'Error during checkout.');
    res.redirect(`/menu?branch=${branchId}`);
  }
});

module.exports = router;