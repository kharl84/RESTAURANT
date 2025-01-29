const express = require('express');
const mongoose = require('mongoose');
const { ensureLoggedIn } = require('connect-ensure-login');
const { roles } = require('../utils/constants');
const User = require('../models/user.model');
const MenuItem = require('../models/MenuItem'); 
const Order = require('../models/order');
const Branch = require('../models/branch');

const router = express.Router();


// Middleware to ensure the user is an admin
function ensureAdmin(req, res, next) {
  console.log(req.user); // Debugging: Check the user object
  if (req.user && req.user.role === roles.admin) {
    return next();
  } else {
    req.flash('warning', 'You are not authorized to view this route');
    return res.redirect('/');
  }
}

// Get route for displaying all users in the admin panel
router.get('/users', ensureAdmin, async (req, res, next) => {
  try {
    const users = await User.find();
    const branches = await Branch.find();
    res.render('manage-users', { users, branches });
  } catch (error) {
    next(error);
  }
});

// Get route for viewing a specific user's profile
router.get('/user/:id', ensureAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash('error', 'Invalid user ID');
      return res.redirect('/admin/users');
    }

    const person = await User.findById(id);
    res.render('profile', { person });
  } catch (error) {
    next(error);
  }
});

router.get('/report', ensureAdmin, async (req, res, next) => {
  try {
    const branchId = req.query.branchId || 'all';
    const branches = await Branch.find();  // Fetch all branches

    // Fetch total users
    const totalUsers = await User.countDocuments();

    // Fetch roles summary
    const rolesSummary = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Fetch recent registrations
    const recentRegistrations = await User.find().sort({ createdAt: -1 }).limit(5);

    let branchName = 'All Branches';
    let menuItems = [];
    let orders = [];

    // Aggregation query to fetch orders and include totalAmount directly from the order
    orders = await Order.aggregate([
      {
        $unwind: '$items'  // Unwind the items array to work with individual items
      },
      {
        $lookup: {
          from: 'menuitems',  // Name of the MenuItem collection
          localField: 'items.menuItem',  // The field in the Order model that holds menuItem ObjectId
          foreignField: '_id',  // Matching field in the MenuItem collection
          as: 'menuItemDetails'  // Output array of matched MenuItems
        }
      },
      {
        $unwind: '$menuItemDetails'  // Unwind the array so we can access individual menuItemDetails
      },
      {
        $lookup: {
          from: 'branches',  // Name of the Branch collection
          localField: 'menuItemDetails.branch',  // The field in MenuItem that references the branch
          foreignField: '_id',  // Matching field in the Branch collection
          as: 'branchDetails'  // Output array of matched Branches
        }
      },
      {
        $unwind: '$branchDetails'  // Unwind branchDetails array to access branch info
      },
      {
        $project: {
          _id: 1,
          'items': 1,
          'user': 1,
          'createdAt': 1,
          'menuItemName': '$menuItemDetails.name',
          'menuItemPrice': '$menuItemDetails.price',
          'branchCity': '$branchDetails.city',
          'quantity': '$items.quantity',  // Get the quantity from the item
          'totalAmount': 1,  // Directly include the totalAmount field from the Order
        }
      },
      {
        $group: {
          _id: '$_id',  // Group by order ID
          totalAmount: { $first: '$totalAmount' },  // Get the totalAmount for this order (already present in the order)
          items: { $push: { name: '$menuItemName', price: '$menuItemPrice', quantity: '$quantity', branch: '$branchCity' } },
          user: { $first: '$user' },  // Get user info (assuming one user per order)
          createdAt: { $first: '$createdAt' },  // Get created date (assuming one created date per order)
        }
      },
      {
        $project: {
          _id: 1,
          items: 1,
          totalAmount: 1,
          user: 1,
          createdAt: 1,
        }
      }
    ]);

    // If a specific branch is selected, filter the orders and menu items for that branch
    if (branchId !== 'all') {
      const branch = await Branch.findById(branchId);
      if (branch) {
        branchName = branch.city;
      }

      // Filter orders to only include those for the selected branch
      orders = orders.filter(order =>
        order.items.some(item => item.branch === branchName)
      );

      // Fetch menu items for the specific branch
      menuItems = await MenuItem.aggregate([
        { $match: { branch: new mongoose.Types.ObjectId(branchId) } },
        {
          $project: {
            name: 1,
            branch: branchName,
            price: 1
          }
        }
      ]);
    } else {
      // Fetch menu items for all branches
      menuItems = await MenuItem.aggregate([
        {
          $lookup: {
            from: 'branches',
            localField: 'branch',
            foreignField: '_id',
            as: 'branchDetails'
          }
        },
        {
          $unwind: '$branchDetails'
        },
        {
          $project: {
            name: 1,
            branch: '$branchDetails.city',
            price: 1
          }
        }
      ]);
    }

    // Render the admin report view
    res.render('admin-report', {
      branches,
      branchId,
      branchName,
      totalUsers,
      rolesSummary,
      recentRegistrations,
      menuItems,
      orders
    });
  } catch (error) {
    console.error('Error fetching report data:', error);
    next(error);
  }
});



// Manage Menu items route (Admin-only)
router.get('/menu', ensureAdmin, async (req, res, next) => {
  try {
    const menuItems = await MenuItem.find();
    const branches = await Branch.find();
    res.render('admin-menu', { menuItems, branches });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    next(error);
  }
});

// Add Menu Item with branch selection
router.post('/menu/add', ensureAdmin, async (req, res, next) => {
  try {
    const { name, description, price, branch } = req.body;

    if (!name || !description || !price || !branch) {
      req.flash('error', 'All fields are required');
      return res.redirect('/admin/menu');
    }

    if (isNaN(price)) {
      req.flash('error', 'Price must be a valid number');
      return res.redirect('/admin/menu');
    }

    if (!mongoose.Types.ObjectId.isValid(branch)) {
      req.flash('error', 'Invalid branch ID');
      return res.redirect('/admin/menu');
    }

    const newMenuItem = new MenuItem({
      name,
      description,
      price,
      branch: new mongoose.Types.ObjectId(branch), // Use validated ObjectId
      selectedCount: 0,
    });

    await newMenuItem.save();
    req.flash('info', 'Menu item added successfully!');
    res.redirect('/admin/menu');
  } catch (error) {
    console.error('Error adding menu item:', error);
    next(error);
  }
});

// Route to delete a menu item by admin
router.post('/menu/delete', ensureAdmin, async (req, res) => {
  try {
    const { itemId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      req.flash('error', 'Invalid item ID');
      return res.redirect('/admin/menu');
    }

    const menuItem = await MenuItem.findById(itemId);
    if (!menuItem) {
      req.flash('error', 'Menu item not found.');
      return res.redirect('/admin/menu');
    }

    await MenuItem.deleteOne({ _id: itemId });
    req.flash('success', 'Menu item deleted successfully.');
    res.redirect('/admin/menu');
  } catch (error) {
    console.error('Error deleting menu item:', error);
    req.flash('error', 'Error deleting menu item.');
    res.redirect('/admin/menu');
  }
});

router.post('/update-role', ensureAdmin, async (req, res, next) => {
  const { id, role } = req.body;

  try {
    // Initialize update data with the role
    let updateData = { role };

    // Validate input
    if (!id || !role) {
      req.flash('error', 'Invalid request. User ID and role are required.');
      return res.redirect('back');
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      req.flash('error', 'Invalid user ID.');
      return res.redirect('back');
    }

    const rolesArray = Object.values(roles);
    if (!rolesArray.includes(role)) {
      req.flash('error', 'Invalid role.');
      return res.redirect('back');
    }

    // No need to assign branch for moderators anymore
    if (role === 'MODERATOR') {
      updateData.branchName = null; // Ensure no branchName is assigned
      updateData.branchId = null;   // Ensure no branchId is assigned
    } else {
      updateData.branchName = null;  // Clear branch if not a moderator
      updateData.branchId = null;    // Clear branchId if not a moderator
    }

    // Update the user in the database
    const user = await User.findByIdAndUpdate(id, updateData, { new: true });

    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('back');
    }

    req.flash('info', `Successfully updated role for ${user.email} to ${user.role}.`);
    res.redirect('back');
  } catch (error) {
    console.error('Error updating user role:', error);
    next(error);
  }
});



module.exports = router;