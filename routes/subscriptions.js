const express = require('express');
const router = express.Router();
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all subscription plans
router.get('/plans', (req, res) => {
  try {
    const plans = Subscription.getPlans();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's current subscription
router.get('/current', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      user: req.user.id,
      status: 'active',
      endDate: { $gt: new Date() }
    }).populate('user', 'name email');

    res.json(subscription);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's subscription history
router.get('/history', auth, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({
      user: req.user.id
    }).sort({ createdAt: -1 });

    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new subscription
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { plan, paymentId } = req.body;
    
    if (!plan || !['basic', 'standard', 'premium'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid subscription plan' });
    }

    const plans = Subscription.getPlans();
    const selectedPlan = plans[plan];

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({
      user: req.user.id,
      status: 'active',
      endDate: { $gt: new Date() }
    });

    if (existingSubscription) {
      return res.status(400).json({ message: 'You already have an active subscription' });
    }

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (selectedPlan.duration * 24 * 60 * 60 * 1000));

    const subscription = new Subscription({
      user: req.user.id,
      plan,
      planName: selectedPlan.name,
      price: selectedPlan.price,
      features: selectedPlan.features,
      status: 'active',
      startDate,
      endDate,
      paymentId
    });

    await subscription.save();
    
    res.status(201).json({
      message: 'Subscription created successfully',
      subscription
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Cancel subscription
router.put('/cancel', auth, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({
      user: req.user.id,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    await subscription.save();

    res.json({
      message: 'Subscription cancelled successfully',
      subscription
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update auto-renew setting
router.put('/auto-renew', auth, async (req, res) => {
  try {
    const { autoRenew } = req.body;
    
    const subscription = await Subscription.findOne({
      user: req.user.id,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({ message: 'No active subscription found' });
    }

    subscription.autoRenew = autoRenew;
    await subscription.save();

    res.json({
      message: 'Auto-renew setting updated successfully',
      subscription
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
