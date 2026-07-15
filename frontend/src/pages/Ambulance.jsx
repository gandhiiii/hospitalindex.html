import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { ambulanceAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function Ambulance() {
  const [ambulances, setAmbulances] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [dispatchForm, setDispatchForm] = useState(null);
  const [form, setForm] = useState({ vehicleNo: '', driverName: '', driverContact: '', attendantName: '', attendantContact: '', ambulanceType: 'basic' });
  const [dispatch, setDispatch] = useState({ destination: { lat: '', lng: '', address: '' }, patientName: '', patientCondition: '' });
  const socket = useSocket();

  useEffect(() => { fetchAmbulances(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('ambulance:location', (data) => setAmbulances(prev => prev.map(a => a._id === data._id ? { ...a, currentLocation: data.currentLocation } : a)));
    socket.on('ambulance:status', (data) => setAmbulances(prev => prev.map(a => a._id === data._id ? { ...a, status: data.status } : a)));
    return () => { socket.off('ambulance:location'); socket.off('ambulance:status'); };
  }, [socket]);

  const fetchAmbulances = async () => {
    try { const { data } = await ambulanceAPI.getAll(); setAmbulances(data); } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await ambulanceAPI.create(form); setShowForm(false); fetchAmbulances(); } catch (err) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    try {
      await ambulanceAPI.dispatch(dispatchForm._id, {
        destination: { lat: +dispatch.destination.lat, lng: +dispatch.destination.lng, address: dispatch.destination.address },
        patientName: dispatch.patientName, patientCondition: dispatch.patientCondition
      });
      setDispatchForm(null); fetchAmbulances();
    } catch (err) { alert('Error'); }
  };

  const handleComplete = async (id) => {
    try { await ambulanceAPI.complete(id); fetchAmbulances(); } catch (err) { alert('Error'); }
  };

  const updateLocation = async (id) => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const location = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Current' };
      const { data } = await ambulanceAPI.updateLocation(id, location);
      if (socket) socket.emit('ambulance:location', data);
      fetchAmbulances();
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Ambulance Management</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ Add Ambulance</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {ambulances.map(a => (
          <div key={a._id} className="card">
            <div className="flex items-start justify-between">
              <div><h3 className="font-medium">{a.vehicleNo}</h3><p className="text-xs text-gray-500">Driver: {a.driverName}</p></div>
              <span className={`badge-${a.status === 'available' ? 'green' : a.status === 'on_duty' ? 'red' : 'yellow'}`}>{a.status}</span>
            </div>
            {a.patientName && <p className="text-xs text-blue-600 mt-1">Patient: {a.patientName}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => updateLocation(a._id)} className="btn-secondary text-xs">📍 Update</button>
              {a.status === 'available' && <button onClick={() => { setDispatchForm(a); }} className="btn-primary text-xs">Dispatch</button>}
              {a.status === 'on_duty' && <button onClick={() => handleComplete(a._id)} className="btn-success text-xs">Complete</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="card h-[400px] overflow-hidden">
        <h3 className="font-medium mb-3">Live Tracking</h3>
        <MapContainer center={[28.6139, 77.209]} zoom={12} className="h-[340px] rounded-lg">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {ambulances.filter(a => a.currentLocation?.lat).map(a => (
            <Marker key={a._id} position={[a.currentLocation.lat, a.currentLocation.lng]}>
              <Popup><strong>{a.vehicleNo}</strong><br />{a.driverName}<br />{a.status}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-start justify-center pt-20" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Ambulance</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Vehicle No</label><input className="input" value={form.vehicleNo} onChange={e => setForm({ ...form, vehicleNo: e.target.value })} required /></div>
                <div><label className="label">Type</label><select className="select" value={form.ambulanceType} onChange={e => setForm({ ...form, ambulanceType: e.target.value })}><option value="basic">Basic</option><option value="advanced">Advanced</option><option value="icu">ICU</option></select></div>
                <div><label className="label">Driver Name</label><input className="input" value={form.driverName} onChange={e => setForm({ ...form, driverName: e.target.value })} required /></div>
                <div><label className="label">Driver Contact</label><input className="input" value={form.driverContact} onChange={e => setForm({ ...form, driverContact: e.target.value })} /></div>
              </div>
              <div className="flex gap-3 justify-end mt-6"><button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Add</button></div>
            </form>
          </div>
        </div>
      )}
      {dispatchForm && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-start justify-center pt-20" onClick={e => e.target === e.currentTarget && setDispatchForm(null)}>
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 mx-4">
            <h3 className="text-lg font-semibold mb-4">Dispatch: {dispatchForm.vehicleNo}</h3>
            <form onSubmit={handleDispatch}>
              <div className="space-y-4">
                <div><label className="label">Patient Name</label><input className="input" value={dispatch.patientName} onChange={e => setDispatch({ ...dispatch, patientName: e.target.value })} required /></div>
                <div><label className="label">Condition</label><textarea className="input" value={dispatch.patientCondition} onChange={e => setDispatch({ ...dispatch, patientCondition: e.target.value })} /></div>
                <div><label className="label">Address</label><input className="input" value={dispatch.destination.address} onChange={e => setDispatch({ ...dispatch, destination: { ...dispatch.destination, address: e.target.value } })} /></div>
              </div>
              <div className="flex gap-3 justify-end mt-6"><button type="button" onClick={() => setDispatchForm(null)} className="btn-secondary">Cancel</button><button type="submit" className="btn-primary">Dispatch</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
