const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Book = require('../models/Book');
const User = require('../models/User');
const Order = require('../models/Order');
const { adminAuth, requirePermission } = require('../middleware/adminAuth');

// Admin Dashboard Stats
router.get('/dashboard', adminAuth, requirePermission('view_dashboard'), async (req, res) => {
  try {
    const [totalBooks, totalUsers, totalOrders, recentOrders] = await Promise.all([
      Book.countDocuments(),
      User.countDocuments({ role: 'user' }),
      Order.countDocuments(),
      Order.find()
        .populate('user', 'name email')
        .populate('items.book', 'title price')
        .sort({ createdAt: -1 })
        .limit(10)
    ]);

    const revenue = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      stats: {
        totalBooks,
        totalUsers,
        totalOrders,
        totalRevenue: revenue[0]?.total || 0
      },
      recentOrders
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Book Management
router.get('/books', adminAuth, requirePermission('manage_books'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    const books = await Book.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await Book.countDocuments(query);
    
    res.json({
      books,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Book
router.post('/books', adminAuth, requirePermission('manage_books'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('author').notEmpty().withMessage('Author is required'),
  body('isbn').notEmpty().withMessage('ISBN is required'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('category').notEmpty().withMessage('Category is required'),
  body('stock').isNumeric().withMessage('Stock must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const book = new Book(req.body);
    await book.save();
    res.status(201).json(book);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: 'ISBN already exists' });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Update Book
router.put('/books/:id', adminAuth, requirePermission('manage_books'), async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete Book
router.delete('/books/:id', adminAuth, requirePermission('manage_books'), async (req, res) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Order Management
router.get('/orders', adminAuth, requirePermission('manage_orders'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    let orders = Order.find(query)
      .populate('user', 'name email')
      .populate('items.book', 'title author price')
      .sort({ createdAt: -1 });

    if (search) {
      // Search by user name or email
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      query.user = { $in: users.map(u => u._id) };
      orders = Order.find(query)
        .populate('user', 'name email')
        .populate('items.book', 'title author price')
        .sort({ createdAt: -1 });
    }
    
    const result = await orders
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Order.countDocuments(query);
    
    res.json({
      orders: result,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Order Status
router.put('/orders/:id/status', adminAuth, requirePermission('manage_orders'), [
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
    .withMessage('Invalid status'),
  body('trackingNumber').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, trackingNumber, notes } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, trackingNumber, notes },
      { new: true }
    ).populate('user', 'name email').populate('items.book', 'title author');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// User Management
router.get('/users', adminAuth, requirePermission('manage_users'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query = { role: 'user' };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    // Add order count and total spent for each user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const orders = await Order.find({ user: user._id });
      const orderCount = orders.length;
      const totalSpent = orders
        .filter(order => order.paymentStatus === 'paid')
        .reduce((sum, order) => sum + order.totalAmount, 0);
      
      return {
        ...user.toObject(),
        orderCount,
        totalSpent
      };
    }));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users: usersWithStats,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete User
router.delete('/users/:id', adminAuth, requirePermission('manage_users'), async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user exists and is not an admin
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admin users' });
    }
    
    // Check if user has any orders
    const orderCount = await Order.countDocuments({ user: userId });
    if (orderCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete user with existing orders. Consider deactivating instead.',
        hasOrders: true,
        orderCount
      });
    }
    
    // Delete the user
    await User.findByIdAndDelete(userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update User Status (activate/deactivate)
router.put('/users/:id/status', adminAuth, requirePermission('manage_users'), [
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;
    const { isActive } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot modify admin user status' });
    }
    
    user.isActive = isActive;
    await user.save();
    
    res.json({ 
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Analytics
router.get('/analytics', adminAuth, requirePermission('view_analytics'), async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [salesData, topBooks, categoryStats] = await Promise.all([
      // Sales over time
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate }, paymentStatus: 'paid' } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            sales: { $sum: '$totalAmount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      
      // Top selling books
      Order.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.book',
            totalSold: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'books',
            localField: '_id',
            foreignField: '_id',
            as: 'book'
          }
        }
      ]),
      
      // Category statistics
      Book.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalStock: { $sum: '$stock' }
          }
        },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      salesData,
      topBooks,
      categoryStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Role and Permission Management
router.get('/roles', adminAuth, requirePermission('manage_permissions'), async (req, res) => {
  try {
    const roles = [
      {
        name: 'admin',
        displayName: 'Administrator',
        description: 'Full system access',
        permissions: ['view_dashboard', 'manage_books', 'manage_orders', 'manage_users', 'view_analytics', 'manage_settings', 'export_data', 'manage_permissions']
      },
      {
        name: 'manager',
        displayName: 'Manager',
        description: 'Management access to books, orders, and analytics',
        permissions: ['view_dashboard', 'manage_books', 'manage_orders', 'view_analytics', 'export_data']
      },
      {
        name: 'staff',
        displayName: 'Staff',
        description: 'Basic access to books and orders',
        permissions: ['view_dashboard', 'manage_books', 'manage_orders']
      },
      {
        name: 'user',
        displayName: 'Customer',
        description: 'Customer account',
        permissions: []
      }
    ];

    const userCounts = await Promise.all(
      roles.map(async (role) => {
        const count = await User.countDocuments({ role: role.name });
        return { ...role, userCount: count };
      })
    );

    res.json({ roles: userCounts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all admin users with their roles and permissions
router.get('/admin-users', adminAuth, requirePermission('manage_permissions'), async (req, res) => {
  try {
    const adminUsers = await User.find({ 
      role: { $in: ['admin', 'manager', 'staff'] } 
    }).select('-password');
    
    res.json({ users: adminUsers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user role and permissions
router.put('/users/:id/role', adminAuth, requirePermission('manage_permissions'), [
  body('role').isIn(['user', 'admin', 'manager', 'staff']).withMessage('Invalid role'),
  body('permissions').optional().isArray().withMessage('Permissions must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.params.id;
    const { role, permissions } = req.body;
    
    // Prevent self-demotion for admin users
    if (req.user._id.toString() === userId && req.user.role === 'admin' && role !== 'admin') {
      return res.status(400).json({ message: 'Cannot demote yourself from admin role' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Set default permissions based on role
    let defaultPermissions = [];
    switch (role) {
      case 'admin':
        defaultPermissions = ['view_dashboard', 'manage_books', 'manage_orders', 'manage_users', 'view_analytics', 'manage_settings', 'export_data', 'manage_permissions'];
        break;
      case 'manager':
        defaultPermissions = ['view_dashboard', 'manage_books', 'manage_orders', 'view_analytics', 'export_data'];
        break;
      case 'staff':
        defaultPermissions = ['view_dashboard', 'manage_books', 'manage_orders'];
        break;
      case 'user':
        defaultPermissions = [];
        break;
    }
    
    user.role = role;
    user.permissions = permissions || defaultPermissions;
    await user.save();
    
    res.json({ 
      message: 'User role updated successfully',
      user: { ...user.toObject(), password: undefined }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get available permissions
router.get('/permissions', adminAuth, requirePermission('manage_permissions'), async (req, res) => {
  try {
    const permissions = [
      { name: 'view_dashboard', displayName: 'View Dashboard', description: 'Access to admin dashboard overview' },
      { name: 'manage_books', displayName: 'Manage Books', description: 'Create, edit, and delete books' },
      { name: 'manage_orders', displayName: 'Manage Orders', description: 'View and update order status' },
      { name: 'manage_users', displayName: 'Manage Users', description: 'View and manage customer accounts' },
      { name: 'view_analytics', displayName: 'View Analytics', description: 'Access to sales and analytics data' },
      { name: 'manage_settings', displayName: 'Manage Settings', description: 'System configuration access' },
      { name: 'export_data', displayName: 'Export Data', description: 'Export system data and reports' },
      { name: 'manage_permissions', displayName: 'Manage Permissions', description: 'Manage user roles and permissions' }
    ];
    
    res.json({ permissions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
