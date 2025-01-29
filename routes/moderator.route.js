const express = require('express');
const router = express.Router();
const { ensureModerator } = require('../utils/middleware');
const Branch = require('../models/branch');
const Order = require('../models/order');
const MenuItem = require('../models/MenuItem');

router.get('/branch-report', ensureModerator, async (req, res, next) => {
  try {
    const branchId = req.query.branchId || 'all'; // Get selected branchId from query string
    const branches = await Branch.find(); // Fetch all branches

    let selectedBranchName = 'All Branches';
    let orders = [];
    let menuItems = [];

    // Fetch data based on the selected branch
    if (branchId !== 'all') {
      const selectedBranch = await Branch.findById(branchId);
      if (!selectedBranch) {
        req.flash('error', 'Branch not found.');
        return res.redirect('/moderator/branch-report');
      }

      selectedBranchName = selectedBranch.name;

      // Fetch orders for the selected branch
      orders = await Order.aggregate([
        {
          $lookup: {
            from: 'menuitems',
            localField: 'items.menuItem',
            foreignField: '_id',
            as: 'menuItemDetails',
          },
        },
        {
          $unwind: '$menuItemDetails',
        },
        {
          $match: { 'menuItemDetails.branch': selectedBranch._id },
        },
        {
          $group: {
            _id: '$_id',
            totalAmount: { $first: '$totalAmount' },
            items: {
              $push: {
                name: '$menuItemDetails.name',
                price: '$menuItemDetails.price',
                quantity: '$items.quantity',
              },
            },
            user: { $first: '$user' },
            createdAt: { $first: '$createdAt' },
          },
        },
      ]);

      // Fetch menu items for the selected branch
      menuItems = await MenuItem.find({ branch: selectedBranch._id });
    } else {
      // Fetch orders for all branches
      orders = await Order.aggregate([
        {
          $lookup: {
            from: 'menuitems',
            localField: 'items.menuItem',
            foreignField: '_id',
            as: 'menuItemDetails',
          },
        },
        {
          $unwind: '$menuItemDetails',
        },
        {
          $lookup: {
            from: 'branches',
            localField: 'menuItemDetails.branch',
            foreignField: '_id',
            as: 'branchDetails',
          },
        },
        {
          $unwind: '$branchDetails',
        },
        {
          $group: {
            _id: '$_id',
            totalAmount: { $first: '$totalAmount' },
            items: {
              $push: {
                name: '$menuItemDetails.name',
                price: '$menuItemDetails.price',
                quantity: '$items.quantity',
                branch: '$branchDetails.name',
              },
            },
            user: { $first: '$user' },
            createdAt: { $first: '$createdAt' },
          },
        },
      ]);

      // Fetch all menu items
      menuItems = await MenuItem.aggregate([
        {
          $lookup: {
            from: 'branches',
            localField: 'branch',
            foreignField: '_id',
            as: 'branchDetails',
          },
        },
        {
          $unwind: '$branchDetails',
        },
        {
          $project: {
            name: 1,
            price: 1,
            branch: '$branchDetails.name',
          },
        },
      ]);
    }

    // Render the branch report for moderators
    res.render('branch-report', {
      branches,
      branchId,
      selectedBranchName,
      orders,
      menuItems,
    });
  } catch (error) {
    console.error('Error fetching branch report:', error);
    next(error);
  }
});

module.exports = router;
