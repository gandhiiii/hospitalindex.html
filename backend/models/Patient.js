const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: Number,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  contactNo: String,
  address: String,
  bloodGroup: String,
  admissionDate: { type: Date },
  dischargeDate: Date,
  department: String,
  roomNo: String,
  bedNo: String,
  doctorAssigned: String,
  diagnosis: String,
  admissionType: { type: String, enum: ['emergency', 'regular', 'referral'] },
  status: { type: String, enum: ['admitted', 'discharged', 'transferred'], default: 'admitted' },
  dischargeSummary: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Patient', patientSchema);
