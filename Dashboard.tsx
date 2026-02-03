import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, TrendingUp, TrendingDown, AlertCircle, Download, 
  ChevronDown, FileText, Image as ImageIcon, Calendar, PieChart as PieChartIcon 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { useApp } from '../context/AppContext';
import { MONTHS, REVENUE_DISTRIBUTION } from '../constants';
import { UserRole } from '../types';
import * as XLSX from 'xlsx';

const StatsCard: React.FC<{ title: string, value: string, icon: React.ReactNode, color: string, onClick?: () => void }> = ({ title, value, icon, color, onClick }) => (
  <div onClick={onClick} className={`card p-4 flex items-center border border-slate-100 shadow-sm transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-95' : ''}`}>
    <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mr-3 shadow-md shrink-0`}>
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 20 }) : icon}
    </div>
    <div className="overflow-hidden">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 truncate">{title}</p>
      <p className="text-lg font-black text-slate-800 tracking-tight truncate">{value}</p>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { transactions, residents, bills, currentUser } = useApp();
  const [dashboardMonth, setDashboardMonth] = useState(new Date().getMonth() + 1);
  const [dashboardYear] = useState(new Date().getFullYear());

  // --- LOGIC CALCULATIONS ---
  const { totalIncome, totalExpense } = useMemo(() => {
    const filtered = transactions.filter(t => {
      const d = new Date(t.date);
      return (d.getMonth() + 1) === dashboardMonth && d.getFullYear() === dashboardYear;
    });
    return {
      totalIncome: filtered.filter(t => t.type === 'INCOME' && t.category !== 'Saldo Awal').reduce((acc, t) => acc + t.amount, 0),
      totalExpense: filtered.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0)
    };
  }, [transactions, dashboardMonth, dashboardYear]);

  const chartData = useMemo(() => {
    const data = MONTHS.map(m => ({ name: m.substring(0, 3), income: 0, expense: 0 }));
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (d.getFullYear() === dashboardYear) {
        const idx = d.getMonth();
        if (t.type === 'INCOME' && t.category !== 'Saldo Awal') data[idx].income += t.amount;
        else if (t.type === 'EXPENSE') data[idx].expense += t.amount;
      }
    });
    return data;
  }, [transactions, dashboardYear]);

  const paymentStatusStats = useMemo(() => {
    const current = bills.filter(b => b.period_month === dashboardMonth && b.period_year === dashboardYear);
    const paid = current.filter(b => b.status === 'PAID').length;
    const unpaid = current.length - paid;
    return {
      data: [{ name: 'Lunas', value: paid, color: '#10B981' }, { name: 'Belum', value: unpaid, color: '#F43F5E' }].filter(d => d.value > 0),
      percent: current.length > 0 ? (paid / current.length) * 100 : 0
    };
  }, [bills, dashboardMonth, dashboardYear]);

  const allocationStats = useMemo(() => {
    const paidCount = bills.filter(b => {
      if (b.status !== 'PAID' || !b.paid_at) return false;
      const d = new Date(b.paid_at);
      return (d.getMonth() + 1) === dashboardMonth && d.getFullYear() === dashboardYear;
    }).length;
    const base = paidCount * 20000;
    if (base === 0) return [];
    return [
      { name: 'KAS RT', value: base * REVENUE_DISTRIBUTION.RT, color: '#6366f1' },
      { name: 'KAS RW', value: base * REVENUE_DISTRIBUTION.RW, color: '#8b5cf6' },
      { name: 'MASJID', value: base * REVENUE_DISTRIBUTION.DKM, color: '#ec4899' },
      { name: 'POSYANDU', value: base * REVENUE_DISTRIBUTION.POSYANDU, color: '#f43f5e' }
    ];
  }, [bills, dashboardMonth, dashboardYear]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Filter */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Dashboard</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laporan Keuangan RT</p>
        </div>
        <select value={dashboardMonth} onChange={(e) => setDashboardMonth(Number(e.target.value))} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none shadow-sm">
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Warga" value={residents.length.toString()} icon={<Users />} color="bg-blue-600" />
        <StatsCard title="Masuk" value={`Rp ${totalIncome.toLocaleString('id-ID')}`} icon={<TrendingUp />} color="bg-emerald-500" />
        <StatsCard title="Keluar" value={`Rp ${totalExpense.toLocaleString('id-ID')}`} icon={<TrendingDown />} color="bg-rose-500" />
        <StatsCard title="Tunggakan" value="Detail" icon={<AlertCircle />} color="bg-amber-500" onClick={() => navigate('/arrears')} />
      </div>

      {/* Line Chart - Trend Arus Kas */}
      <div className="card p-6 border border-slate-100 shadow-sm bg-white rounded-2xl">
        <h3 className="text-sm font-black text-slate-800 uppercase mb-6">Tren Arus Kas {dashboardYear}</h3>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px' }} />
              <Line type="monotone" dataKey="income" name="Masuk" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
              <Line type="monotone" dataKey="expense" name="Keluar" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Chart */}
        <div className="card p-6 border border-slate-100 shadow-sm bg-white rounded-2xl">
          <h3 className="text-sm font-black text-slate-800 uppercase mb-4">Realisasi Bayar</h3>
          <div style={{ width: '100%', height: 180 }} className="relative">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={paymentStatusStats.data} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={8} dataKey="value" stroke="none">
                  {paymentStatusStats.data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-slate-800">{paymentStatusStats.percent.toFixed(0)}%</span>
            </div>
          </div>
          {/* Legend 11px */}
          <div className="mt-6 space-y-2">
            {paymentStatusStats.data.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[11px] font-black text-slate-500 uppercase">{item.name}</span>
                </div>
                <span className="text-[11px] font-black text-slate-800">{item.value} Warga</span>
              </div>
            ))}
          </div>
        </div>

        {/* Allocation Chart */}
        <div className="card p-6 border border-slate-100 shadow-sm bg-white rounded-2xl">
          <h3 className="text-sm font-black text-slate-800 uppercase mb-4">Alokasi Kas</h3>
          <div style={{ width: '100%', height: 180 }}>
            {allocationStats.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={allocationStats} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                    {allocationStats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `Rp ${v.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-slate-300 text-xs italic">Belum ada iuran</div>}
          </div>
          {/* Legend 11px */}
          <div className="mt-6 grid grid-cols-1 gap-2">
            {allocationStats.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[11px] font-black text-slate-500 uppercase">{item.name}</span>
                </div>
                <span className="text-[11px] font-black text-slate-800">Rp {item.value.toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
