import { useState, useEffect, useRef } from 'react';
import { reportAPI, inventoryAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TABS = ['Common Report', 'Department Report', 'Inventory Report'];

function formatDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function formatVal(v) {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function safeName(obj) {
  if (!obj) return '-';
  if (typeof obj === 'string') return obj;
  return obj.name || obj._id || '-';
}

export default function Reports() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [commonData, setCommonData] = useState(null);
  const [deptData, setDeptData] = useState(null);
  const [invData, setInvData] = useState(null);
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();

  useEffect(() => {
    reportAPI.getDepartmentsList().then(({ data }) => setDepartments(data)).catch(() => {});
  }, []);

  const fetchCommon = async () => {
    setLoading(true); setError('');
    try { const { data } = await reportAPI.getAll(); setCommonData(data); } catch (e) { setError(e.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const fetchDept = async () => {
    if (!selectedDept) return;
    setLoading(true); setError('');
    try { const { data } = await reportAPI.getByDepartment(selectedDept); setDeptData(data); } catch (e) { setError(e.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const fetchInventory = async () => {
    setLoading(true); setError('');
    try { const { data } = await reportAPI.getInventory(); setInvData(data); } catch (e) { setError(e.response?.data?.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tab === 0 && !commonData) fetchCommon(); }, [tab]);
  useEffect(() => { if (tab === 1 && selectedDept) fetchDept(); }, [tab, selectedDept]);
  useEffect(() => { if (tab === 2 && !invData) fetchInventory(); }, [tab]);

  if (!isAdmin) return <div className="card text-center text-gray-500 py-12">Only Admin can access Reports</div>;

  const exportPDF = (title, columns, rows) => {
    const doc = new jsPDF({ orientation: rows.length > 20 ? 'landscape' : 'portrait' });
    doc.setFontSize(16); doc.text(title, 14, 15);
    doc.setFontSize(8); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    doc.autoTable({ columns: columns.map(c => ({ header: c, dataKey: c })), body: rows.map(r => { const o = {}; columns.forEach((c, i) => { o[c] = formatVal(r[i] ?? r[c]); }); return o; }), startY: 27, styles: { fontSize: 7 }, headStyles: { fillColor: [59, 130, 246] } });
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  };

  const exportExcel = (title, columns, rows, sheetName) => {
    const data = rows.map(r => {
      const o = {};
      columns.forEach((c, i) => { o[c] = r[i] ?? r[c] ?? ''; });
      return o;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Report');
    XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Reports</h2>
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === i ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}>{t}</button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}
      {loading && <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>}

      {!loading && tab === 0 && (
        <CommonReport data={commonData} exportPDF={exportPDF} exportExcel={exportExcel} />
      )}

      {!loading && tab === 1 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <select className="select max-w-xs" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
              <option value="">-- Select Department --</option>
              {departments.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
            </select>
            <button onClick={fetchDept} className="btn-primary text-sm" disabled={!selectedDept}>Load Report</button>
          </div>
          {deptData && <DepartmentReport data={deptData} exportPDF={exportPDF} exportExcel={exportExcel} refresh={fetchDept} />}
        </div>
      )}

      {!loading && tab === 2 && (
        <InventoryReport data={invData} exportPDF={exportPDF} exportExcel={exportExcel} refresh={fetchInventory} />
      )}
    </div>
  );
}

function CommonReport({ data, exportPDF, exportExcel }) {
  if (!data) return <p className="text-gray-400 text-sm text-center py-10">Click to load report</p>;

  const sections = [
    { label: 'Users', count: data.users?.length || 0, fields: ['Name', 'Email', 'Mobile', 'Role', 'Department', 'Designation', 'Status'], rows: (data.users || []).map(u => [u.name, u.email, u.mobile, u.role, u.department || '-', u.designation || '-', u.isActive ? 'Active' : 'Inactive']) },
    { label: 'Patients', count: data.patients?.length || 0, fields: ['Name', 'Age', 'Gender', 'Contact', 'Department', 'Room', 'Status', 'Admission'], rows: (data.patients || []).map(p => [p.name, p.age || '-', p.gender || '-', p.contactNo || '-', p.department || '-', p.roomNo || '-', p.status, formatDate(p.admissionDate)]) },
    { label: 'Inventory', count: data.inventory?.length || 0, fields: ['Name', 'Category', 'Quantity', 'Unit', 'Department', 'Status', 'Price'], rows: (data.inventory || []).map(i => [i.name, i.category, i.quantity, i.unit, i.department || '-', i.status, i.purchasePrice ? `₹${i.purchasePrice}` : '-']) },
    { label: 'Tasks', count: data.tasks?.length || 0, fields: ['Title', 'Priority', 'Status', 'Assigned To', 'Department', 'Due Date'], rows: (data.tasks || []).map(t => [t.title, t.priority, t.status, safeName(t.assignedTo), t.department || '-', formatDate(t.dueDate)]) },
    { label: 'Complaints', count: data.complaints?.length || 0, fields: ['Patient', 'Room', 'Type', 'Priority', 'Status', 'Assigned To'], rows: (data.complaints || []).map(c => [c.patientName, c.roomNo || '-', c.complaintType, c.priority, c.status, safeName(c.assignedTo)]) },
    { label: 'Ambulances', count: data.ambulances?.length || 0, fields: ['Vehicle No', 'Driver', 'Contact', 'Type', 'Status'], rows: (data.ambulances || []).map(a => [a.vehicleNo, a.driverName, a.driverContact || '-', a.ambulanceType, a.status]) },
    { label: 'Gate Entries', count: data.gateEntries?.length || 0, fields: ['Type', 'Person', 'Company', 'Vehicle', 'Status', 'In Time'], rows: (data.gateEntries || []).map(g => [g.type, g.personName, g.companyName || '-', g.vehicleNo || '-', g.status, formatDate(g.inTime)]) },
    { label: 'Projects', count: data.projects?.length || 0, fields: ['Title', 'Category', 'Priority', 'Status', 'Start Date', 'Est. Cost'], rows: (data.projects || []).map(p => [p.title, p.category, p.priority, p.status, formatDate(p.startDate), p.estimatedCost ? `₹${p.estimatedCost}` : '-']) },
    { label: 'Problems', count: data.problems?.length || 0, fields: ['Title', 'Category', 'Priority', 'Status', 'Department', 'Reported By'], rows: (data.problems || []).map(p => [p.title, p.category, p.priority, p.status, p.department || '-', safeName(p.reportedBy)]) },
    { label: 'Room Checklists', count: data.roomChecklists?.length || 0, fields: ['Room No', 'Floor', 'Type', 'Status', 'Department', 'Completed'], rows: (data.roomChecklists || []).map(r => [r.roomNo, r.floor || '-', r.checklistType, r.status, r.department || '-', r.completedAt ? 'Yes' : '-']) },
    { label: 'Floor Checklists', count: data.floorChecklists?.length || 0, fields: ['Floor', 'Zone', 'Status', 'Assigned To'], rows: (data.floorChecklists || []).map(f => [f.floor, f.zone, f.status, safeName(f.assignedTo)]) },
    { label: 'Lost & Found', count: data.lostFound?.length || 0, fields: ['Type', 'Item', 'Location', 'Status', 'Date'], rows: (data.lostFound || []).map(l => [l.type, l.itemName, l.location || '-', l.status, formatDate(l.dateFound || l.dateLost)]) }
  ];

  const allRows = [];
  sections.forEach(s => { s.rows.forEach(r => { allRows.push([s.label, ...r]); }); });
  const allCols = ['Section', ...sections.reduce((acc, s) => s.fields.length > acc.length ? s.fields : acc, [])];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Generated: {new Date().toLocaleString()} | Total records: {data.meta?.totalUsers || 0} users, {sections.reduce((s, sec) => s + sec.count, 0)} records</p>
        <div className="flex gap-2">
          <button onClick={() => exportPDF('Common_Report', allCols, allRows)} className="btn-secondary text-xs">PDF</button>
          <button onClick={() => exportExcel('Common_Report', allCols, allRows, 'Common')} className="btn-primary text-xs">Excel</button>
        </div>
      </div>
      <div className="space-y-6">
        {sections.map(sec => sec.count > 0 && (
          <div key={sec.label} className="card">
            <h3 className="text-sm font-semibold mb-3 text-blue-600">{sec.label} ({sec.count})</h3>
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-gray-50 sticky top-0">{sec.fields.map(f => <th key={f} className="text-left p-1.5 border-b font-medium whitespace-nowrap">{f}</th>)}</tr></thead>
                <tbody>{sec.rows.map((row, i) => <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">{row.map((v, j) => <td key={j} className="p-1.5 whitespace-nowrap">{formatVal(v)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        ))}
        {sections.every(s => s.count === 0) && <p className="text-gray-400 text-center py-10">No data available</p>}
      </div>
    </div>
  );
}

function DepartmentReport({ data, exportPDF, exportExcel, refresh }) {
  if (!data) return null;

  const sections = [
    { label: 'Users', rows: (data.users || []).map(u => [u.name, u.email, u.role, u.designation || '-']) },
    { label: 'Patients', rows: (data.patients || []).map(p => [p.name, p.age || '-', p.gender || '-', p.contactNo || '-', p.roomNo || '-', p.status]) },
    { label: 'Inventory', rows: (data.inventory || []).map(i => [i.name, i.category, i.quantity, i.status]) },
    { label: 'Tasks', rows: (data.tasks || []).map(t => [t.title, t.priority, t.status, safeName(t.assignedTo), formatDate(t.dueDate)]) },
    { label: 'Complaints', rows: (data.complaints || []).map(c => [c.patientName, c.complaintType, c.priority, c.status, safeName(c.assignedTo)]) },
    { label: 'Problems', rows: (data.problems || []).map(p => [p.title, p.priority, p.status, safeName(p.reportedBy)]) },
    { label: 'Room Checklists', rows: (data.roomChecklists || []).map(r => [r.roomNo, r.checklistType, r.status]) },
    { label: 'Projects', rows: (data.projects || []).map(p => [p.title, p.priority, p.status, formatDate(p.startDate), p.estimatedCost ? `₹${p.estimatedCost}` : '-']) }
  ];

  const allRows = [];
  const fieldMap = { 'Users': ['Name', 'Email', 'Role', 'Designation'], 'Patients': ['Name', 'Age', 'Gender', 'Contact', 'Room', 'Status'], 'Inventory': ['Name', 'Category', 'Qty', 'Status'], 'Tasks': ['Title', 'Priority', 'Status', 'Assigned To', 'Due Date'], 'Complaints': ['Patient', 'Type', 'Priority', 'Status', 'Assigned To'], 'Problems': ['Title', 'Priority', 'Status', 'Reported By'], 'Room Checklists': ['Room', 'Type', 'Status'], 'Projects': ['Title', 'Priority', 'Status', 'Start', 'Cost'] };
  sections.forEach(s => { s.rows.forEach(r => { allRows.push([s.label, ...r]); }); });

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
        <div><p className="font-semibold text-blue-800">{data.department?.name || selectedDept}</p><p className="text-xs text-blue-600">{data.department?.category || ''} | {data.stats?.users || 0} Users, {data.stats?.patients || 0} Patients, {data.stats?.inventory || 0} Inventory</p></div>
        <div className="flex gap-2">
          <button onClick={() => exportPDF(`Department_${data.department?.name}`, ['Section', ...Object.values(fieldMap).reduce((a, f) => f.length > a.length ? f : a, [])], allRows)} className="btn-secondary text-xs">PDF</button>
          <button onClick={() => exportExcel(`Department_${data.department?.name}`, ['Section', ...Object.values(fieldMap).reduce((a, f) => f.length > a.length ? f : a, [])], allRows, 'Dept')} className="btn-primary text-xs">Excel</button>
        </div>
      </div>
      <div className="space-y-4">
        {sections.map(sec => sec.rows.length > 0 && (
          <div key={sec.label} className="card">
            <h3 className="text-sm font-semibold mb-3 text-blue-600">{sec.label} ({sec.rows.length})</h3>
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-gray-50 sticky top-0">{fieldMap[sec.label].map(f => <th key={f} className="text-left p-1.5 border-b font-medium">{f}</th>)}</tr></thead>
                <tbody>{sec.rows.map((row, i) => <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">{row.map((v, j) => <td key={j} className="p-1.5 whitespace-nowrap">{formatVal(v)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        ))}
        {sections.every(s => s.rows.length === 0) && <p className="text-gray-400 text-center py-10">No data for this department</p>}
      </div>
    </div>
  );
}

function InventoryReport({ data, exportPDF, exportExcel, refresh }) {
  if (!data) return null;

  const itemRows = (data.allItems || []).map(i => [i.name, i.category, i.quantity, i.unit, i.department || '-', i.status, i.location || '-', i.purchasePrice ? `₹${i.purchasePrice}` : '-', i.supplier || '-']);
  const lowStockRows = (data.lowStock?.items || []).map(i => [i.name, i.category, i.quantity, i.unit, i.department || '-', i.status]);
  const catRows = (data.byCategory || []).map(c => [c.category, c.total, `₹${c.totalValue}`]);
  const deptRows = (data.byDepartment || []).map(d => [d.department, d.total, `₹${d.totalValue}`]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Total Items: {data.meta?.totalItems || 0} | Total Value: ₹{data.meta?.totalValue?.toLocaleString() || 0} | Low Stock Items: {data.lowStock?.count || 0}</p>
        <div className="flex gap-2">
          <button onClick={() => exportPDF('Inventory_Report', ['Name', 'Category', 'Qty', 'Unit', 'Dept', 'Status', 'Location', 'Price', 'Supplier'], itemRows)} className="btn-secondary text-xs">PDF</button>
          <button onClick={() => exportExcel('Inventory_Report', ['Name', 'Category', 'Qty', 'Unit', 'Dept', 'Status', 'Location', 'Price', 'Supplier'], itemRows, 'Inventory')} className="btn-primary text-xs">Excel</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {data.byCategory?.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 text-blue-600">By Category</h3>
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-xs"><thead><tr className="bg-gray-50"><th className="text-left p-1.5 border-b">Category</th><th className="text-right p-1.5 border-b">Total Qty</th><th className="text-right p-1.5 border-b">Value</th></tr></thead>
                <tbody>{catRows.map((r, i) => <tr key={i} className="border-t border-gray-50"><td className="p-1.5 font-medium">{r[0]}</td><td className="p-1.5 text-right">{r[1]}</td><td className="p-1.5 text-right">{r[2]}</td></tr>)}</tbody></table>
            </div>
          </div>
        )}
        {data.byDepartment?.length > 0 && (
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 text-blue-600">By Department</h3>
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-xs"><thead><tr className="bg-gray-50"><th className="text-left p-1.5 border-b">Department</th><th className="text-right p-1.5 border-b">Total Qty</th><th className="text-right p-1.5 border-b">Value</th></tr></thead>
                <tbody>{deptRows.map((r, i) => <tr key={i} className="border-t border-gray-50"><td className="p-1.5 font-medium">{r[0]}</td><td className="p-1.5 text-right">{r[1]}</td><td className="p-1.5 text-right">{r[2]}</td></tr>)}</tbody></table>
            </div>
          </div>
        )}
      </div>
      {data.lowStock?.count > 0 && (
        <div className="card mb-4 border-red-200">
          <h3 className="text-sm font-semibold mb-3 text-red-600">Low Stock Items ({data.lowStock.count})</h3>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="w-full text-xs"><thead><tr className="bg-red-50"><th className="text-left p-1.5 border-b">Name</th><th className="text-left p-1.5 border-b">Category</th><th className="text-right p-1.5 border-b">Qty</th><th className="text-left p-1.5 border-b">Unit</th><th className="text-left p-1.5 border-b">Dept</th><th className="text-left p-1.5 border-b">Status</th></tr></thead>
              <tbody>{lowStockRows.map((r, i) => <tr key={i} className="border-t border-gray-50"><td className="p-1.5 font-medium">{r[0]}</td><td className="p-1.5">{r[1]}</td><td className="p-1.5 text-right font-bold text-red-600">{r[2]}</td><td className="p-1.5">{r[3]}</td><td className="p-1.5">{r[4]}</td><td className="p-1.5">{r[5]}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
      {itemRows.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold mb-3 text-blue-600">All Inventory Items ({itemRows.length})</h3>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs"><thead><tr className="bg-gray-50 sticky top-0"><th className="text-left p-1.5 border-b">Name</th><th className="text-left p-1.5 border-b">Category</th><th className="text-right p-1.5 border-b">Qty</th><th className="text-left p-1.5 border-b">Unit</th><th className="text-left p-1.5 border-b">Dept</th><th className="text-left p-1.5 border-b">Status</th><th className="text-left p-1.5 border-b">Location</th><th className="text-right p-1.5 border-b">Price</th><th className="text-left p-1.5 border-b">Supplier</th></tr></thead>
              <tbody>{itemRows.map((r, i) => <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">{r.map((v, j) => <td key={j} className="p-1.5 whitespace-nowrap">{formatVal(v)}</td>)}</tr>)}</tbody></table>
          </div>
        </div>
      )}
      {itemRows.length === 0 && <p className="text-gray-400 text-center py-10">No inventory data</p>}
    </div>
  );
}
