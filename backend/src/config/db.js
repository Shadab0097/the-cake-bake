const mongoose = require('mongoose');
const logger = require('../middleware/logger');

const getDetailedErrorHint = (error) => {
  const errorMessage = error.message || '';
  const errorCode = error.code || '';
  const errorName = error.name || '';

  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
    return `
  HINT: Cannot reach MongoDB server.
  - Check if Atlas cluster is running at https://cloud.mongodb.com
  - Verify cluster hasn't gone dormant (free tier sleeps after 1 hour)
  - Check your internet connection`;
  }

  if (errorMessage.includes('authentication failed') || errorMessage.includes('Auth failed')) {
    return `
  HINT: Authentication failed.
  - Verify MONGODB_URI credentials in .env file
  - Check Atlas Dashboard > Security > Database Access
  - Ensure user has readWrite access to the database`;
  }

  if (errorMessage.includes('IP whitelist') || errorMessage.includes('not in whitelist') || errorCode === 8000) {
    return `
  HINT: IP not whitelisted!
  - Go to Atlas Dashboard > Security > Network Access
  - Click "Add IP Address" and add your current IP
  - Or use "Allow Access from Anywhere" (0.0.0.0/0) for dev`;
  }

  if (errorMessage.includes('cluster') && (errorMessage.includes('sleep') || errorMessage.includes('paused'))) {
    return `
  HINT: Atlas cluster may be sleeping.
  - Login to https://cloud.mongodb.com
  - Wake up your cluster by clicking "Connect" button
  - Free tier clusters sleep after ~1 hour of inactivity`;
  }

  if (errorName === 'MongoServerError' && errorCode === 18) {
    return `
  HINT: Authentication handshake failed.
  - Double-check username and password in MONGODB_URI
  - Ensure the database user exists in Atlas > Security > Database Access`;
  }

  return `
  HINT: Common fixes:
  - Check MongoDB Atlas dashboard for cluster status
  - Verify network whitelist includes your IP
  - Confirm database credentials are correct
  - Try waking up cluster if free tier (Atlas Dashboard > Connect)`;
};

const maskUri = (uri) => {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
};

const connectDB = async () => {
  const maskedUri = maskUri(process.env.MONGODB_URI || '');

  logger.info(`Attempting MongoDB connection to: ${maskedUri}`);

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
    });

    logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name} (pool: ${conn.connection.getClient().options.maxPoolSize})`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Mongoose will auto-reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return conn;
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    logger.error(getDetailedErrorHint(error));
    process.exit(1);
  }
};

module.exports = connectDB;

