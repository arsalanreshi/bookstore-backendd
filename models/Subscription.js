const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  plan: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    required: true
  },
  planName: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  features: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'pending'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  paymentId: {
    type: String
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ endDate: 1 });

// Virtual for checking if subscription is currently active
subscriptionSchema.virtual('isActive').get(function() {
  return this.status === 'active' && this.endDate > new Date();
});

// Method to check if subscription has specific feature
subscriptionSchema.methods.hasFeature = function(feature) {
  return this.features.includes(feature);
};

// Static method to get subscription plans
subscriptionSchema.statics.getPlans = function() {
  return {
    basic: {
      name: 'Basic Plan',
      price: 99,
      duration: 30, // days
      features: [
        'Access to PDF books',
        'Basic customer support',
        'Mobile app access'
      ],
      description: 'Perfect for casual readers'
    },
    standard: {
      name: 'Standard Plan', 
      price: 299,
      duration: 30,
      features: [
        'Access to PDF books',
        'Priority customer support',
        'Mobile app access',
        'Offline reading',
        'Bookmarks & notes'
      ],
      description: 'Great for regular readers'
    },
    premium: {
      name: 'Premium Plan',
      price: 599,
      duration: 30,
      features: [
        'Access to PDF books',
        'Premium customer support',
        'Mobile app access',
        'Offline reading',
        'Bookmarks & notes',
        'Exclusive content',
        'Early access to new releases'
      ],
      description: 'Ultimate reading experience'
    }
  };
};

// Pre-save middleware to update updatedAt
subscriptionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
