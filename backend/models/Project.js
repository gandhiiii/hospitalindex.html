const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  category: { type: String, required: true },
  department: String,
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['planning', 'in_progress', 'completed', 'on_hold', 'cancelled'], default: 'planning' },
  startDate: Date,
  endDate: Date,
  estimatedCost: Number,
  actualCost: Number,
  milestones: [{ title: String, description: String, dueDate: Date, status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' } }],
  costs: [{ category: String, estimatedAmount: Number, actualAmount: Number, vendor: String, note: String }],
  assignedTeam: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  projectHead: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
