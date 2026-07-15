const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  brand: String,
  model: String,
  serialNumber: String,
  quantity: { type: Number, default: 0 },
  unit: { type: String, default: 'pcs' },
  location: String,
  department: String,
  purchaseDate: Date,
  purchasePrice: Number,
  supplier: String,
  warrantyExpiry: Date,
  expiryDate: Date,
  lifecycleYears: Number,
  lifecycleBar: { type: Number, default: 100 },
  status: { type: String, enum: ['active', 'expired', 'damaged', 'disposed'], default: 'active' },
  transactions: [{
    type: { type: String, enum: ['in', 'out'] },
    quantity: Number,
    personName: String,
    department: String,
    note: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Inventory', inventorySchema);
