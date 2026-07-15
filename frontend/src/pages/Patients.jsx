import { useState, useEffect } from 'react';
import { patientAPI } from '../services/api';

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', age: '', gender: 'male', contactNo: '', department: '', roomNo: '', bedNo: '', doctorAssigned: '', diagnosis: '', admissionType: 'regular' });

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    try { const { data } = await patientAPI.getAll(); setPatients(data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await patientAPI.create(form); setShowForm(false); fetchPatients(); } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleDischarge = async (id) => {
    const summary = prompt('Discharge summary:');
    if (summary === null) return;
    try { await patientAPI.update(id, { status: 'discharged', dischargeSummary: summary }); fetchPatients(); } catch (err) { alert('Error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Patient Management</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ New Admission</button>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-start justify-center pt-10" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 mx-4">
            <h3 className="text-lg font-semibold mb-4">New Admission</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Name</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                <div><label className="label">Age</label><input type="number" className="input" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} /></div>
                <div><label className="label">Gender</label><select className="select" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="male">Male</option><option value="female">Female</option></select></div>
                <div><label className="label">Contact</label><input className="input" value={form.contactNo} onChange={e => setForm({ ...form, contactNo: e.target.value })} /></div>
                <div><label className="label">Department</label><input className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
                <div><label className="label">Room/Bed</label><input className="input" value={form.roomNo} onChange={e => setForm({ ...form, roomNo: e.target.value })} placeholder="e.g. 401/B" /></div>
                <div><label className="label">Doctor</label><input className="input" value={form.doctorAssigned} onChange={e => setForm({ ...form, doctorAssigned: e.target.value })} /></div>
                <div><label className="label">Type</label><select className="select" value={form.admissionType} onChange={e => setForm({ ...form, admissionType: e.target.value })}><option value="regular">Regular</option><option value="emergency">Emergency</option></select></div>
                <div className="col-span-2"><label className="label">Diagnosis</label><textarea className="input" value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} /></div>
              </div>
              <div className="flex gap-3 justify-end mt-6"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Admit</button></div>
            </form>
          </div>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b"><th className="table-header">Patient</th><th className="table-header">Contact</th><th className="table-header">Room</th><th className="table-header">Doctor</th><th className="table-header">Status</th><th className="table-header">Actions</th></tr></thead>
          <tbody>
            {patients.map(p => (
              <tr key={p._id} className="border-b hover:bg-gray-50">
                <td className="table-cell"><p className="font-medium">{p.name}</p><p className="text-xs text-gray-400">{p.age}/{p.gender}</p></td>
                <td className="table-cell text-xs">{p.contactNo}</td>
                <td className="table-cell text-xs">{p.roomNo || '-'}</td>
                <td className="table-cell text-xs">{p.doctorAssigned || '-'}</td>
                <td className="table-cell"><span className={p.status === 'admitted' ? 'badge-green' : 'badge-gray'}>{p.status}</span></td>
                <td className="table-cell">{p.status === 'admitted' && <button onClick={() => handleDischarge(p._id)} className="text-red-600 hover:underline text-xs">Discharge</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
