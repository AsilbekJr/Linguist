/**
 * Payme/Click integration stub — phase 2 billing.
 * Implement merchant API callbacks and map to User.subscription.provider = 'payme' | 'click'.
 */

const createPaymeCheckout = async () => {
  throw new Error('Payme integration is not configured yet. Use Stripe for now.');
};

const createClickCheckout = async () => {
  throw new Error('Click integration is not configured yet. Use Stripe for now.');
};

const handlePaymeWebhook = async () => {
  throw new Error('Payme webhook not implemented');
};

module.exports = {
  createPaymeCheckout,
  createClickCheckout,
  handlePaymeWebhook,
};
