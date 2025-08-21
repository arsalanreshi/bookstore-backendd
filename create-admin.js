const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@bookstore.com' });
    if (existingAdmin) {
      console.log('Admin user already exists');
      console.log('Email: admin@bookstore.com');
      console.log('Password: admin123');
      return;
    }

    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@bookstore.com',
      password: 'admin123', // This will be hashed by the pre-save hook
      role: 'admin',
      permissions: [
        'view_dashboard',
        'manage_books',
        'manage_orders',
        'manage_users',
        'view_analytics',
        'manage_settings',
        'export_data',
        'manage_permissions'
      ]
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    console.log('Email: admin@bookstore.com');
    console.log('Password: admin123');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();
