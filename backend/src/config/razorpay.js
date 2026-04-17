const Razorpay = require('razorpay');
const { env } = require('./env');

let razorpayInstance = null;

const getRazorpayInstance = () => {
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: env.razorpay.keyId,
      key_secret: env.razorpay.keySecret,
    });
  }
  return razorpayInstance;
};

module.exports = { getRazorpayInstance };
