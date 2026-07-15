const express = require('express');
const router = express.Router();
const GateEntry = require('../models/GateEntry');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const entries = await GateEntry.find(req.query).populate('approvedBy', 'name').sort({ createdAt: -1 });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const count = await GateEntry.countDocuments();
    const gatePassNo = `GP${String(count + 1).padStart(6, '0')}`;
    const entry = await GateEntry.create({ ...req.body, gatePassNo, createdBy: req.user._id });
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/approve', protect, async (req, res) => {
  try {
    const { status, approvalNote } = req.body;
    const entry = await GateEntry.findByIdAndUpdate(req.params.id, { status, approvedBy: req.user._id, approvalNote }, { new: true });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id/checkout', protect, async (req, res) => {
  try {
    const entry = await GateEntry.findByIdAndUpdate(req.params.id, { outTime: new Date(), status: 'completed' }, { new: true });
    res.json(entry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
