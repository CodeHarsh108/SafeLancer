// Returns true when no live Razorpay key is configured.
// Live keys start with 'rzp_live_'. Everything else (missing, placeholder, rzp_test_*) is test mode.
function isTestMode() {
  const key = process.env.RAZORPAY_KEY_ID || '';
  return !key.startsWith('rzp_live_');
}

module.exports = isTestMode;
