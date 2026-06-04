const mongoose = require('mongoose');

const billingEventSchema = new mongoose.Schema({
  provider: { type: String, enum: ['stripe', 'payme', 'click'], required: true },
  eventId: { type: String, required: true, unique: true },
  type: String,
  payload: mongoose.Schema.Types.Mixed,
  processedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('BillingEvent', billingEventSchema);
