import { useState, useEffect } from 'react';
import { taskAPI, userAPI } from '../services/api';

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', assignedTo: '', department: '', dueDate: '' });

  useEffect(() => { fetchTasks(); fetchEmployees(); }, []);

  const fetchTasks = async () => {
    try { const { data } = await taskAPI.getAll(); setTasks(data); } catch (err) { console.error(err); }
  };
  const fetchEmployees = async () => {
    try { const { data } = await userAPI.getAll(); setEmployees(data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await taskAPI.create(form); setShowForm(false); setForm({ title: '', description: '', priority: 'medium', assignedTo: '', department: '', dueDate: '' });
      fetchTasks();
    } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const updateStatus = async (id, status) => {
    try { await taskAPI.update(id, { status }); fetchTasks(); } catch (err) { alert('Error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Task Management</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ New Task</button>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-start justify-center pt-20" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 mx-4">
            <h3 className="text-lg font-semibold mb-4">New Task</h3>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div><label className="label">Title</label><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
                <div><label className="label">Description</label><textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Priority</label><select className="select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
                  <div><label className="label">Assign To</label><select className="select" value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })}><option value="">Select</option>{employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}</select></div>
                  <div><label className="label">Department</label><input className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
                  <div><label className="label">Due Date</label><input type="date" className="input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Create</button></div>
            </form>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task._id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{task.title}</h3>
                  <span className={`badge-${task.priority === 'urgent' ? 'red' : task.priority === 'high' ? 'yellow' : 'blue'}`}>{task.priority}</span>
                  <span className={`badge-${task.status === 'completed' ? 'green' : task.status === 'in_progress' ? 'blue' : 'yellow'}`}>{task.status}</span>
                </div>
                {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
                <div className="flex gap-4 mt-2 text-xs text-gray-400">
                  {task.assignedTo && <span>👤 {task.assignedTo.name}</span>}
                  {task.dueDate && <span>📅 {new Date(task.dueDate).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                {task.status === 'pending' && <button onClick={() => updateStatus(task._id, 'in_progress')} className="btn-primary text-xs">Start</button>}
                {task.status === 'in_progress' && <button onClick={() => updateStatus(task._id, 'completed')} className="btn-success text-xs">Complete</button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
