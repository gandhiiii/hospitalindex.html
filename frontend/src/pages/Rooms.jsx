import { useState, useEffect } from 'react';
import { roomAPI } from '../services/api';

const checklistTemplates = {
  daily: [
    { name: 'Bed', category: 'Furniture' }, { name: 'Light', category: 'Electrical' },
    { name: 'Fan', category: 'Electrical' }, { name: 'AC', category: 'HVAC' },
    { name: 'TV', category: 'Electronics' }, { name: 'Nurse Calling', category: 'System' },
    { name: 'MGPS', category: 'Medical' }, { name: 'Oxygen Flow Meter', category: 'Medical' },
    { name: 'Door Lock', category: 'Civil' }, { name: 'Door Closer', category: 'Civil' },
    { name: 'Fire Alarm', category: 'Safety' }, { name: 'Smoke Detector', category: 'Safety' },
    { name: 'Fire Extinguisher', category: 'Safety' }, { name: 'Fire Sprinkler', category: 'Safety' },
    { name: 'Camera', category: 'Security' }, { name: 'Speaker', category: 'System' },
    { name: 'WiFi Router', category: 'IT' }, { name: 'Plumbing', category: 'Plumbing' },
    { name: 'Water Tap', category: 'Plumbing' }, { name: 'Cleanliness', category: 'Housekeeping' },
  ],
  weekly: [
    { name: 'Fire Extinguisher - Pressure Check', category: 'Safety' },
    { name: 'Fire Sprinkler - No Blockage', category: 'Safety' },
    { name: 'Emergency Exit Light', category: 'Safety' },
    { name: 'Door Closer - Smooth Operation', category: 'Civil' },
    { name: 'Door Stopper', category: 'Civil' },
    { name: 'Door Handle Tightening', category: 'Civil' },
    { name: 'Window Lock & Handle', category: 'Civil' },
    { name: 'Grab Bar - Bathroom', category: 'Civil' },
    { name: 'Electrical Switchboard', category: 'Electrical' },
    { name: 'Power Socket Working', category: 'Electrical' },
    { name: 'Exhaust Fan - Bathroom', category: 'Electrical' },
    { name: 'Geyser - Leakage Check', category: 'Electrical' },
    { name: 'AC - Temperature Setting', category: 'HVAC' },
    { name: 'AC - Drain Pipe', category: 'HVAC' },
    { name: 'AC - Remote Working', category: 'HVAC' },
    { name: 'TV - Channel / Remote', category: 'Electronics' },
    { name: 'Fridge - Temperature', category: 'Electronics' },
    { name: 'Nurse Calling - Test Call', category: 'System' },
    { name: 'MGPS - Vacuum Pressure', category: 'Medical' },
    { name: 'Oxygen Flow - Check', category: 'Medical' },
    { name: 'Bed Side Rail', category: 'Furniture' },
    { name: 'Bed Brake Lock', category: 'Furniture' },
    { name: 'Curtain Track & Privacy', category: 'Furniture' },
    { name: 'Flush Tank - Mechanism', category: 'Plumbing' },
    { name: 'Basin Tap - Dripping', category: 'Plumbing' },
    { name: 'Shower Head & Holder', category: 'Plumbing' },
    { name: 'Drainage - Slow Flow', category: 'Plumbing' },
    { name: 'Floor Cleanliness', category: 'Housekeeping' },
    { name: 'Walls & Paint Condition', category: 'Civil' },
    { name: 'Linen / Towel Stock', category: 'Housekeeping' },
    { name: 'Bio-Waste Bin', category: 'Housekeeping' },
  ],
  monthly: [
    { name: 'HVAC - Filter Cleaning', category: 'HVAC' },
    { name: 'HVAC - Cooling Coil Check', category: 'HVAC' },
    { name: 'HVAC - Condensate Drain', category: 'HVAC' },
    { name: 'AC - Gas Pressure', category: 'HVAC' },
    { name: 'Geyser - Safety Valve', category: 'Electrical' },
    { name: 'Geyser - Thermostat', category: 'Electrical' },
    { name: 'Electrical Panel - MCB Test', category: 'Electrical' },
    { name: 'Earth Leakage Check', category: 'Electrical' },
    { name: 'UPS / Backup Power Test', category: 'Electrical' },
    { name: 'Nurse Calling - Full System', category: 'System' },
    { name: 'Fire Alarm - Full Test', category: 'Safety' },
    { name: 'Smoke Detector - Sensitivity', category: 'Safety' },
    { name: 'Fire Extinguisher - Certified', category: 'Safety' },
    { name: 'Fire Sprinkler - Flow Test', category: 'Safety' },
    { name: 'MGPS - Pipeline Leak Test', category: 'Medical' },
    { name: 'Medical Gas Alarm Test', category: 'Medical' },
    { name: 'Oxygen Cylinder - Stock', category: 'Medical' },
    { name: 'Suction Apparatus Test', category: 'Medical' },
    { name: 'Camera - Alignment & Recording', category: 'Security' },
    { name: 'Camera - Night Vision', category: 'Security' },
    { name: 'Door Lock - Lubrication', category: 'Civil' },
    { name: 'Window Seal & Weatherstrip', category: 'Civil' },
    { name: 'Furniture - Tightening', category: 'Furniture' },
    { name: 'Mattress Condition', category: 'Furniture' },
    { name: 'Plumbing - Pipe Leak Check', category: 'Plumbing' },
    { name: 'Water Tank - Cleaning Due', category: 'Plumbing' },
    { name: 'Drainage - Jet Flush Needed', category: 'Plumbing' },
    { name: 'Bathroom - Grouting & Sealant', category: 'Civil' },
    { name: 'CCTV Recorder - Storage', category: 'Security' },
    { name: 'WiFi - Speed Test', category: 'IT' },
    { name: 'Intercom / Paging System', category: 'System' },
    { name: 'Deep Cleaning - Done', category: 'Housekeeping' },
    { name: 'Pest Control Due', category: 'Housekeeping' },
    { name: 'Paint / Touch Up Needed', category: 'Civil' },
    { name: 'Roof / Ceiling Leak Check', category: 'Civil' },
  ],
  pre_admission: [
    { name: 'Bed - Clean / Linen Ready', category: 'Furniture' },
    { name: 'Light / Fan Working', category: 'Electrical' },
    { name: 'AC Working', category: 'HVAC' },
    { name: 'TV & Remote Working', category: 'Electronics' },
    { name: 'Nurse Calling Tested', category: 'System' },
    { name: 'MGPS / Oxygen Ready', category: 'Medical' },
    { name: 'Room Clean & Disinfected', category: 'Housekeeping' },
    { name: 'Bathroom Clean / Supplies', category: 'Housekeeping' },
    { name: 'Fire Alarm / Sensors OK', category: 'Safety' },
    { name: 'Door Lock Working', category: 'Civil' },
    { name: 'Fridge Working', category: 'Electronics' },
    { name: 'WiFi Working', category: 'IT' },
  ],
  post_discharge: [
    { name: 'Bed - Stripped / Disinfected', category: 'Furniture' },
    { name: 'All Linen Collected', category: 'Housekeeping' },
    { name: 'Biowaste Removed', category: 'Housekeeping' },
    { name: 'General Waste Removed', category: 'Housekeeping' },
    { name: 'Furniture Wiped / Disinfected', category: 'Furniture' },
    { name: 'Floor Deep Cleaned', category: 'Housekeeping' },
    { name: 'AC Filter Cleaned', category: 'HVAC' },
    { name: 'Bathroom Disinfected', category: 'Housekeeping' },
    { name: 'MGPS - Purged', category: 'Medical' },
    { name: 'Oxygen - Valve Closed', category: 'Medical' },
    { name: 'Nurse Calling Reset', category: 'System' },
    { name: 'TV / Remote Sanitized', category: 'Electronics' },
    { name: 'Fridge Cleaned', category: 'Electronics' },
    { name: 'Door / Window Check', category: 'Civil' },
    { name: 'Fire Alarm - Reset', category: 'Safety' },
    { name: 'Room Ready for Next Patient', category: 'Housekeeping' },
  ],
};

export default function Rooms() {
  const [checklists, setChecklists] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ roomNo: '', floor: '', checklistType: 'daily', items: checklistTemplates.daily.map(i => ({ ...i, isChecked: false, note: '' })) });

  useEffect(() => { fetchChecklists(); }, []);

  const fetchChecklists = async () => {
    try { const { data } = await roomAPI.getAll(); setChecklists(data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await roomAPI.create(form); setShowForm(false); fetchChecklists(); } catch (err) { alert('Error'); }
  };

  const toggleItem = async (checklistId, itemId) => {
    const c = checklists.find(c => c._id === checklistId);
    if (!c) return;
    const items = c.items.map(item => item._id === itemId ? { ...item, isChecked: !item.isChecked, _id: item._id } : item);
    try { await roomAPI.updateItems(checklistId, { items }); fetchChecklists(); } catch (err) { }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Room Checklist</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ New Checklist</button>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-start justify-center pt-10" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 mx-4">
            <h3 className="text-lg font-semibold mb-4">New Room Checklist</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="label">Room No</label><input className="input" value={form.roomNo} onChange={e => setForm({ ...form, roomNo: e.target.value })} required /></div>
                <div><label className="label">Floor</label><input className="input" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} /></div>
                <div><label className="label">Type</label>
                  <select className="select" value={form.checklistType} onChange={e => {
                    const type = e.target.value;
                    const items = (checklistTemplates[type] || []).map(i => ({ ...i, isChecked: false, note: '' }));
                    setForm({ ...form, checklistType: type, items });
                  }}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="pre_admission">Pre Admission</option>
                    <option value="post_discharge">Post Discharge</option>
                  </select>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-lg p-3">
                {form.items.map((item, i) => (
                  <label key={i} className="flex items-center gap-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded px-2">
                    <input type="checkbox" checked={item.isChecked} onChange={() => {
                      const items = [...form.items]; items[i].isChecked = !items[i].isChecked; setForm({ ...form, items });
                    }} className="rounded" />
                    <span className="text-xs text-gray-400 w-20">{item.category}</span>
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3 justify-end mt-6"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Create</button></div>
            </form>
          </div>
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-start justify-center pt-10" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 mx-4">
            <h3 className="text-lg font-semibold mb-2">Room {selected.roomNo} - {selected.checklistType}</h3>
            <p className="text-sm text-gray-500 mb-4">Floor: {selected.floor} | <span className={`badge-${selected.status === 'completed' ? 'green' : 'yellow'}`}>{selected.status}</span></p>
            <div className="space-y-2">
              {selected.items.map(item => (
                <div key={item._id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
                  <input type="checkbox" checked={item.isChecked} onChange={() => toggleItem(selected._id, item._id)} className="rounded" />
                  <span className="text-xs text-gray-400 w-20">{item.category}</span>
                  <span className="flex-1 text-sm">{item.name}</span>
                  {item.isChecked && <span className="badge-green">OK</span>}
                </div>
              ))}
            </div>
            <button onClick={() => setSelected(null)} className="btn-secondary mt-6">Close</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {checklists.map(c => (
          <div key={c._id} className="card card-hover cursor-pointer" onClick={() => setSelected(c)}>
            <div className="flex items-start justify-between">
              <div><h3 className="font-medium">Room {c.roomNo}</h3><p className="text-xs text-gray-500">{c.floor}</p></div>
              <div className="flex flex-col items-end gap-1">
                <span className={`badge-${c.checklistType === 'daily' ? 'green' : c.checklistType === 'weekly' ? 'blue' : c.checklistType === 'monthly' ? 'purple' : c.checklistType === 'pre_admission' ? 'yellow' : 'gray'}`}>{c.checklistType.replace('_', ' ')}</span>
                <span className={`badge-${c.status === 'completed' ? 'green' : 'yellow'}`}>{c.status}</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${c.items.filter(i => i.isChecked).length / Math.max(c.items.length, 1) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-500">{c.items.filter(i => i.isChecked).length}/{c.items.length}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
