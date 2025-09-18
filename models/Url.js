const mongoose = require("mongoose");

const clickSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  referrer: { type: String, default: null },
  ip: { type: String, default: null },
  location: { type: String, default: "Unknown" },
});

const urlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortcode: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  expiryAt: { type: Date, required: true },
  clicks: [clickSchema],
  clickCount: { type: Number, default: 0 },
});

// Index to auto-delete expired docs (MongoDB TTL index)
urlSchema.index({ expiryAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Url", urlSchema);
