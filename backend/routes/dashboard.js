const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Inventory = require('../models/Inventory');
const Task = require('../models/Task');
const Complaint = require('../models/Complaint');
const Ambulance = require('../models/Ambulance');
const GateEntry = require('../models/GateEntry');
const Project = require('../models/Project');
const ProblemSolution = require('../models/ProblemSolution');
const FloorChecklist = require('../models/FloorChecklist');

router.get('/', protect, async (req, res) => {
  try {
    const [totalPatients, admitted, discharged, totalInv, lowStock, pendingTasks, inProgress, pendingComp, resolvedComp, availAmbulance, onDuty, pendingGate, approvedGate, activeProjects, planningProjects, pendingProblems, resolvedProblems] = await Promise.all([
      Patient.countDocuments(), Patient.countDocuments({ status: 'admitted' }), Patient.countDocuments({ status: 'discharged' }),
      Inventory.countDocuments(), Inventory.countDocuments({ quantity: { $lte: 5 } }),
      Task.countDocuments({ status: 'pending' }), Task.countDocuments({ status: 'in_progress' }),
      Complaint.countDocuments({ status: 'pending' }), Complaint.countDocuments({ status: 'resolved' }),
      Ambulance.countDocuments({ status: 'available' }), Ambulance.countDocuments({ status: 'on_duty' }),
      GateEntry.countDocuments({ status: 'pending' }), GateEntry.countDocuments({ status: 'approved' }),
      Project.countDocuments({ status: 'in_progress' }), Project.countDocuments({ status: 'planning' }),
      ProblemSolution.countDocuments({ status: 'reported' }), ProblemSolution.countDocuments({ status: 'resolved' })
    ]);
    res.json({
      patients: { total: totalPatients, admitted, discharged },
      inventory: { total: totalInv, lowStock },
      tasks: { pending: pendingTasks, inProgress },
      complaints: { pending: pendingComp, resolved: resolvedComp },
      ambulances: { available: availAmbulance, onDuty },
      gate: { pending: pendingGate, approved: approvedGate },
      projects: { active: activeProjects, planning: planningProjects },
      problems: { pending: pendingProblems, resolved: resolvedProblems }
    });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/workload', protect, async (req, res) => {
  try {
    const users = await User.find({ role: { $nin: ['superadmin'] } }).select('name email role department');
    const workload = await Promise.all(users.map(async (user) => {
      const [tasks, complaints, problems, floorChecklists] = await Promise.all([
        Task.find({ assignedTo: user._id }).select('status'),
        Complaint.find({ assignedTo: user._id }).select('status'),
        ProblemSolution.find({ assignedTo: user._id }).select('status'),
        FloorChecklist.find({ assignedTo: user._id }).select('status')
      ]);
      return {
        _id: user._id, name: user.name, email: user.email, role: user.role, department: user.department,
        tasks: { total: tasks.length, pending: tasks.filter(t => t.status === 'pending').length, inProgress: tasks.filter(t => t.status === 'in_progress').length, completed: tasks.filter(t => t.status === 'completed').length },
        complaints: { total: complaints.length, pending: complaints.filter(c => c.status === 'pending').length, inProgress: complaints.filter(c => c.status === 'in_progress').length, resolved: complaints.filter(c => c.status === 'resolved').length },
        problems: { total: problems.length, active: problems.filter(p => ['reported', 'reviewing', 'in_progress'].includes(p.status)).length, resolved: problems.filter(p => ['resolved', 'closed'].includes(p.status)).length },
        floorChecklists: { total: floorChecklists.length, completed: floorChecklists.filter(f => f.status === 'completed').length }
      };
    }));
    res.json(workload);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

router.get('/kpi', protect, async (req, res) => {
  try {
    const users = await User.find({ role: { $nin: ['superadmin'] } }).select('name email role department');
    const kpi = await Promise.all(users.map(async (user) => {
      const [tasks, complaints] = await Promise.all([
        Task.find({ assignedTo: user._id }).select('status'),
        Complaint.find({ assignedTo: user._id }).select('status')
      ]);
      const taskRate = tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0;
      const complaintRate = complaints.length > 0 ? (complaints.filter(c => c.status === 'resolved').length / complaints.length) * 100 : 0;
      const overallScore = (taskRate + complaintRate) / 2;
      let kpiLevel = 'Poor';
      if (overallScore >= 90) kpiLevel = 'Excellent';
      else if (overallScore >= 75) kpiLevel = 'Good';
      else if (overallScore >= 50) kpiLevel = 'Average';
      else if (overallScore >= 25) kpiLevel = 'Below Average';
      return { name: user.name, department: user.department, role: user.role, taskCompletionRate: Math.round(taskRate * 10) / 10, complaintResolutionRate: Math.round(complaintRate * 10) / 10, overallScore: Math.round(overallScore * 10) / 10, kpiLevel, taskCount: tasks.length, complaintCount: complaints.length };
    }));
    res.json(kpi);
  } catch (error) { res.status(500).json({ message: error.message }); }
});

module.exports = router;
