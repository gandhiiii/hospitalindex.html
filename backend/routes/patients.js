const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const patients = await Patient.find(req.query).sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const patient = await Patient.create({ ...req.body, createdBy: req.user._id, admissionDate: new Date() });
    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.body.status === 'discharged') updateData.dischargeDate = new Date();
    const patient = await Patient.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Not found' });
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
