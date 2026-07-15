import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const KPI_COLORS = { Excellent: '#10b981', Good: '#3b82f6', Average: '#f59e0b', 'Below Average': '#f97316', Poor: '#ef4444' };

const statCards = [
  { key: 'patients', label: 'Total Patients', sub: 'admitted', subLabel: 'Admitted', icon: '👨‍⚕️' },
  { key: 'inventory', label: 'Inventory Items', sub: 'lowStock', subLabel: 'Low Stock', icon: '📦' },
  { key: 'tasks', label: 'Pending Tasks', sub: 'inProgress', subLabel: 'In Progress', icon: '✅' },
  { key: 'complaints', label: 'Complaints', sub: 'resolved', subLabel: 'Resolved', icon: '📝' },
  { key: 'ambulances', label: 'Ambulances', sub: 'onDuty', subLabel: 'On Duty', icon: '🚑' },
  { key: 'gate', label: 'Gate Entries', sub: 'approved', subLabel: 'Approved', icon: '🚧' },
  { key: 'projects', label: 'Active Projects', sub: 'planning', subLabel: 'Planning', icon: '📋' },
  { key: 'problems', label: 'Reported Problems', sub: 'resolved', subLabel: 'Resolved', icon: '⚠️' }
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [workload, setWorkload] = useState([]);
  const [kpi, setKpi] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin, user } = useAuth();
  const socket = useSocket();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, w, k] = await Promise.all([
        dashboardAPI.getStats(),
        isAdmin ? dashboardAPI.getWorkload() : Promise.resolve({ data: [] }),
        isAdmin ? dashboardAPI.getKPI() : Promise.resolve({ data: [] })
      ]);
      setStats(s.data);
      setWorkload(w.data);
      setKpi(k.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    if (!socket) return;
    socket.on('dashboard:refresh', fetchAll);
    return () => socket.off('dashboard:refresh');
  }, [socket]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  const workloadChart = workload.map(w => ({ name: w.name.split(' ')[0], Tasks: w.tasks.total, Complaints: w.complaints.total, Problems: w.problems.total }));
  const kpiChart = kpi.filter(k => k.taskCount > 0 || k.complaintCount > 0).map(k => ({ name: k.name.split(' ')[0], 'Task Rate': k.taskCompletionRate, 'Complaint Rate': k.complaintResolutionRate, Overall: k.overallScore }));
  const kpiDistribution = Object.entries(KPI_COLORS).map(([level]) => ({ name: level, value: kpi.filter(k => k.kpiLevel === level).length })).filter(d => d.value > 0);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(card => {
          const main = stats?.[card.key];
          const total = main?.total ?? main?.pending ?? main?.available ?? main?.active ?? main ?? 0;
          const sub = main?.[card.sub] ?? 0;
          return (
            <div key={card.key} className="card card-hover">
              <div className="flex items-start justify-between">
                <div><p className="text-sm text-gray-500">{card.label}</p><p className="text-2xl font-bold mt-1">{total}</p></div>
                <span className="text-2xl">{card.icon}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>{card.subLabel}: <strong>{sub}</strong></span>
                <span>Total: <strong>{total}</strong></span>
              </div>
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="text-base font-semibold mb-4">Employee Workload</h3>
              {workloadChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={workloadChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Tasks" fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="Complaints" fill="#f59e0b" radius={[4,4,0,0]} />
                    <Bar dataKey="Problems" fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-sm text-center py-10">No workload data yet</p>}
            </div>
            <div className="card">
              <h3 className="text-base font-semibold mb-4">KPI Distribution</h3>
              {kpiDistribution.length > 0 ? (
                <div className="flex items-center justify-center h-[300px]">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={kpiDistribution} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                        {kpiDistribution.map((entry, i) => <Cell key={i} fill={KPI_COLORS[entry.name]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-gray-400 text-sm text-center py-10">No KPI data yet</p>}
            </div>
          </div>

          <div className="card mb-6">
            <h3 className="text-base font-semibold mb-4">Employee KPI Scores (%)</h3>
            {kpiChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={kpiChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Overall" fill="#8b5cf6" radius={[4,4,0,0]} />
                  <Bar dataKey="Task Rate" fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="Complaint Rate" fill="#10b981" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-sm text-center py-10">No KPI data yet</p>}
          </div>

          <div className="card">
            <h3 className="text-base font-semibold mb-4">KPI Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50"><th className="text-left p-2">Employee</th><th className="text-left p-2">Department</th><th className="text-right p-2">Task Rate</th><th className="text-right p-2">Complaint Rate</th><th className="text-right p-2">Overall</th><th className="text-center p-2">Level</th></tr></thead>
                <tbody>
                  {kpi.filter(k => k.taskCount > 0 || k.complaintCount > 0).map((k, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-2 font-medium">{k.name}</td>
                      <td className="p-2 text-gray-500">{k.department || '-'}</td>
                      <td className="p-2 text-right">{k.taskCompletionRate}%</td>
                      <td className="p-2 text-right">{k.complaintResolutionRate}%</td>
                      <td className="p-2 text-right font-semibold">{k.overallScore}%</td>
                      <td className="p-2 text-center"><span className="badge" style={{ backgroundColor: KPI_COLORS[k.kpiLevel] + '20', color: KPI_COLORS[k.kpiLevel], border: '1px solid ' + KPI_COLORS[k.kpiLevel], padding: '2px 8px', borderRadius: '999px', fontSize: 11 }}>{k.kpiLevel}</span></td>
                    </tr>
                  ))}
                  {kpi.filter(k => k.taskCount > 0 || k.complaintCount > 0).length === 0 && <tr><td colSpan={6} className="text-center text-gray-400 py-6">No KPI data available</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
