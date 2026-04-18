// Returns true only when no valid Razorpay key is configured (missing or placeholder).
// Both rzp_test_* and rzp_live_* keys use the real Razorpay API.
function isTestMode() {
  const key = process.env.RAZORPAY_KEY_ID || '';
  return !key.startsWith('rzp_test_') && !key.startsWith('rzp_live_');
}

module.exports = isTestMode;
