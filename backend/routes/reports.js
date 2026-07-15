const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Department = require('../models/Department');
const Patient = require('../models/Patient');
const Inventory = require('../models/Inventory');
const Task = require('../models/Task');
const Complaint = require('../models/Complaint');
const Ambulance = require('../models/Ambulance');
const GateEntry = require('../models/GateEntry');
const Project = require('../models/Project');
const ProblemSolution = require('../models/ProblemSolution');
const RoomChecklist = require('../models/RoomChecklist');
const FloorChecklist = require('../models/FloorChecklist');
const LostFound = require('../models/LostFound');

router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const [departments, users, patients, inventory, tasks, complaints, ambulances, gateEntries, projects, problems, roomChecklists, floorChecklists, lostFound] = await Promise.all([
      Department.find().lean(),
      User.find().select('-password').lean(),
      Patient.find().lean(),
      Inventory.find().lean(),
      Task.find().populate('assignedTo', 'name email').lean(),
      Complaint.find().populate('assignedTo', 'name').lean(),
      Ambulance.find().lean(),
      GateEntry.find().populate('approvedBy', 'name').lean(),
      Project.find().populate('projectHead', 'name').lean(),
      ProblemSolution.find().populate('reportedBy resolvedBy', 'name').lean(),
      RoomChecklist.find().lean(),
      FloorChecklist.find().populate('assignedTo', 'name').lean(),
      LostFound.find().lean()
    ]);
    res.json({ meta: { generatedAt: new Date(), totalUsers: users.length, totalDepartments: departments.length }, departments, users, patients, inventory, tasks, complaints, ambulances, gateEntries, projects, problems, roomChecklists, floorChecklists, lostFound });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/department/:name', protect, adminOnly, async (req, res) => {
  try {
    const deptName = req.params.name;
    const department = await Department.findOne({ name: deptName }).lean();
    if (!department) return res.status(404).json({ message: 'Department not found' });
    const [users, patients, inventory, tasks, complaints, problems, roomChecklists, projects] = await Promise.all([
      User.find({ department: deptName }).select('-password').lean(),
      Patient.find({ department: deptName }).lean(),
      Inventory.find({ department: deptName }).lean(),
      Task.find({ department: deptName }).populate('assignedTo', 'name').lean(),
      Complaint.find().populate('assignedTo', 'name').lean(),
      ProblemSolution.find({ department: deptName }).populate('reportedBy resolvedBy', 'name').lean(),
      RoomChecklist.find({ department: deptName }).lean(),
      Project.find({ department: deptName }).lean()
    ]);
    const deptComplaints = complaints.filter(c => users.some(u => u._id.toString() === (c.assignedTo?._id?.toString() || c.assignedTo?.toString())));
    res.json({ department, stats: { users: users.length, patients: patients.length, inventory: inventory.length, tasks: tasks.length, complaints: deptComplaints.length, problems: problems.length, roomChecklists: roomChecklists.length, projects: projects.length }, users, patients, inventory, tasks, complaints: deptComplaints, problems, roomChecklists, projects });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/inventory', protect, adminOnly, async (req, res) => {
  try {
    const items = await Inventory.find().lean();
    const lowStock = items.filter(i => i.quantity <= 5);
    const byCategory = {};
    items.forEach(i => {
      if (!byCategory[i.category]) byCategory[i.category] = { items: [], total: 0, totalValue: 0 };
      byCategory[i.category].items.push(i);
      byCategory[i.category].total += i.quantity;
      byCategory[i.category].totalValue += (i.purchasePrice || 0) * i.quantity;
    });
    const byDepartment = {};
    items.forEach(i => {
      if (!i.department) return;
      if (!byDepartment[i.department]) byDepartment[i.department] = { items: [], total: 0, totalValue: 0 };
      byDepartment[i.department].items.push(i);
      byDepartment[i.department].total += i.quantity;
      byDepartment[i.department].totalValue += (i.purchasePrice || 0) * i.quantity;
    });
    res.json({ meta: { totalItems: items.length, totalValue: items.reduce((s, i) => s + ((i.purchasePrice || 0) * i.quantity), 0) }, lowStock: { count: lowStock.length, items: lowStock }, byCategory: Object.entries(byCategory).map(([k, v]) => ({ category: k, ...v })), byDepartment: Object.entries(byDepartment).map(([k, v]) => ({ department: k, ...v })), allItems: items });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/departments-list', protect, async (req, res) => {
  try { const departments = await Department.find({ isActive: true }).select('name').lean(); res.json(departments); }
  catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
