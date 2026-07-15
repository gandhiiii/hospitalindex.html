const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const filter = { ...req.query };
    const tasks = await Task.find(filter).populate('assignedTo', 'name email').populate('assignedBy', 'name').sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const task = await Task.create({ ...req.body, assignedBy: req.user._id });
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.body.status === 'completed') updateData.completedAt = new Date();
    const task = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
