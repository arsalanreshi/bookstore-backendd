const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function migrateAdminPermissions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all admin users without permissions or with empty permissions
    const adminUsers = await User.find({
      role: 'admin',
      $or: [
        { permissions: { $exists: false } },
        { permissions: { $size: 0 } },
        { permissions: null }
      ]
    });

    console.log(`Found ${adminUsers.length} admin users to update`);

    // Update each admin user with full permissions
    const fullPermissions = [
      'view_dashboard',
      'manage_books',
      'manage_orders',
      'manage_users',
      'view_analytics',
      'manage_settings',
      'export_data',
      'manage_permissions'
    ];

    for (const user of adminUsers) {
      user.permissions = fullPermissions;
      await user.save();
      console.log(`Updated permissions for admin user: ${user.email}`);
    }

    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

migrateAdminPermissions();
