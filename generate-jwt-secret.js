const crypto = require('crypto');

// Generate a secure random JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');

console.log('Your JWT Secret:');
console.log(jwtSecret);
console.log('\nAdd this to your Vercel environment variables as JWT_SECRET');
