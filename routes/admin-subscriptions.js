const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const { adminAuth } = require('../middleware/adminAuth');

// Get all subscriptions with pagination and filters
router.get('/', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { status, plan, search } = req.query;
    
    // Build filter object
    let filter = {};
    if (status) filter.status = status;
    if (plan) filter.plan = plan;
    
    // If search is provided, search by user email or name
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      filter.user = { $in: users.map(u => u._id) };
    }

    const subscriptions = await Subscription.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Subscription.countDocuments(filter);

    res.json({
      subscriptions,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get subscription statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const stats = await Promise.all([
      // Total subscriptions
      Subscription.countDocuments(),
      
      // Active subscriptions
      Subscription.countDocuments({ 
        status: 'active',
        endDate: { $gt: new Date() }
      }),
      
      // Expired subscriptions
      Subscription.countDocuments({ 
        status: 'expired'
      }),
      
      // Cancelled subscriptions
      Subscription.countDocuments({ 
        status: 'cancelled'
      }),
      
      // Revenue this month
      Subscription.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            },
            status: { $in: ['active', 'expired'] }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$price' }
          }
        }
      ]),
      
      // Plan distribution
      Subscription.aggregate([
        {
          $group: {
            _id: '$plan',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const [total, active, expired, cancelled, revenueResult, planDistribution] = stats;
    const monthlyRevenue = revenueResult[0]?.total || 0;

    res.json({
      total,
      active,
      expired,
      cancelled,
      monthlyRevenue,
      planDistribution: planDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get subscription by ID
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id)
      .populate('user', 'name email phone createdAt');

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    res.json(subscription);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update subscription status
router.put('/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'expired', 'cancelled', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const subscription = await Subscription.findById(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    subscription.status = status;
    await subscription.save();

    res.json({
      message: 'Subscription status updated successfully',
      subscription
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Extend subscription
router.put('/:id/extend', adminAuth, async (req, res) => {
  try {
    const { days } = req.body;
    
    if (!days || days <= 0) {
      return res.status(400).json({ message: 'Invalid number of days' });
    }

    const subscription = await Subscription.findById(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    // Extend the end date
    subscription.endDate = new Date(subscription.endDate.getTime() + (days * 24 * 60 * 60 * 1000));
    await subscription.save();

    res.json({
      message: `Subscription extended by ${days} days`,
      subscription
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete subscription
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    await Subscription.findByIdAndDelete(req.params.id);

    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk operations
router.post('/bulk', adminAuth, async (req, res) => {
  try {
    const { action, subscriptionIds } = req.body;
    
    if (!action || !subscriptionIds || !Array.isArray(subscriptionIds)) {
      return res.status(400).json({ message: 'Invalid request data' });
    }

    let result;
    
    switch (action) {
      case 'cancel':
        result = await Subscription.updateMany(
          { _id: { $in: subscriptionIds } },
          { status: 'cancelled', autoRenew: false }
        );
        break;
        
      case 'activate':
        result = await Subscription.updateMany(
          { _id: { $in: subscriptionIds } },
          { status: 'active' }
        );
        break;
        
      case 'delete':
        result = await Subscription.deleteMany(
          { _id: { $in: subscriptionIds } }
        );
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid action' });
    }

    res.json({
      message: `Bulk ${action} completed successfully`,
      modifiedCount: result.modifiedCount || result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
