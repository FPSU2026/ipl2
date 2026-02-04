
import React, { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Download,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Calendar,
  PieChart as PieChartIcon,
  Target,
  CheckCircle2,
  Wallet,
  Home
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useApp } from '../context/AppContext';
import { MONTHS, REVENUE_DISTRIBUTION } from '../constants';
import { UserRole } from '../types';
import * as XLSX from 'xlsx';

// Compact Clickable StatsCard Component
const StatsCard: React.FC<{ 
  title: string, 
  value: string, 
  icon: React.ReactNode, 
  color: string, 
  onClick?: () => void 
}> = ({ title, value, icon, color, onClick }) => (
  <div 
    onClick={onClick}
    className={`card p-4 flex items-center border border-slate-100 shadow-sm transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-95' : ''}`}
  >
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
  const lineChartRef = useRef<HTMLDivElement>(null);
  const piePaymentRef = useRef<HTMLDivElement>(null);
  const pieAllocationRef = useRef<HTMLDivElement>(null);
  
  const [showExportLine, setShowExportLine] = useState(false);
  const [showExportPayment, setShowExportPayment] = useState(false);
  const [showExportAllocation, setShowExportAllocation] = useState(false);
  
  // Dashboard Filters
  const [dashboardMonth, setDashboardMonth] = useState(new Date().getMonth() + 1);
  const [dashboardYear, setDashboardYear] = useState(new Date().getFullYear());

  const { transactions, residents, bills, currentUser, settings, bankAccounts } = useApp();
  const isResident = currentUser?.role === UserRole.RESIDENT;

  // --- CALCULATION LOGIC ---

  // 1. Total Saldo Aktif (Kas + Bank)
  const activeBalance = useMemo(() => {
    const cash = settings.cash_initial_balance || 0;
    const bank = bankAccounts.reduce((acc, b) => acc + (b.balance || 0), 0);
    return cash + bank;
  }, [settings.cash_initial_balance, bankAccounts]);

  // 2. Total Rumah
  const totalHouses = residents.length;

  // 3. Penerimaan & Pengeluaran Berjalan (Berdasarkan Arus Kas Transaksi pada Bulan Terpilih)
  const { totalIncome, totalExpense } = useMemo(() => {
      const filtered = transactions.filter(t => {
          const d = new Date(t.date);
          return (d.getMonth() + 1) === dashboardMonth && d.getFullYear() === dashboardYear;
      });

      const inc = filtered.filter(t => t.type === 'INCOME' && t.category !== 'Saldo Awal');
      const exp = filtered.filter(t => t.type === 'EXPENSE');
      
      return { 
        totalIncome: inc.reduce((acc, t) => acc + t.amount, 0), 
        totalExpense: exp.reduce((acc, t) => acc + t.amount, 0)
      };
  }, [transactions, dashboardMonth, dashboardYear]);

  // 4. Realisasi Pembayaran Iuran (KHUSUS DARI DATA TAGIHAN)
  const billingStats = useMemo(() => {
      const periodBills = bills.filter(b => 
          b.period_month === dashboardMonth && 
          b.period_year === dashboardYear
      );
      
      const totalCount = periodBills.length;
      const paidBills = periodBills.filter(b => b.status === 'PAID');
      const unpaidBills = periodBills.filter(b => b.status === 'UNPAID');

      const paidCount = paidBills.length;
      const unpaidCount = unpaidBills.length;

      const totalTargetNominal = periodBills.reduce((acc, b) => acc + b.total, 0);
      const totalRealizationNominal = paidBills.reduce((acc, b) => acc + (b.paid_amount || 0), 0);
      const totalOutstandingNominal = unpaidBills.reduce((acc, b) => acc + (b.total - (b.paid_amount || 0)), 0);

      const percentagePaidCount = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

      const pieData = [
          { name: 'Lunas', value: paidCount, nominal: totalRealizationNominal, color: '#10B981' },
          { name: 'Belum Lunas', value: unpaidCount, nominal: totalOutstandingNominal, color: '#F43F5E' }
      ].filter(i => i.value > 0 || i.nominal > 0);

      return { 
          pieData, 
          totalCount, 
          paidCount, 
          unpaidCount, 
          percentagePaidCount,
          totalTargetNominal,
          totalRealizationNominal,
          totalOutstandingNominal
      };
  }, [bills, dashboardMonth, dashboardYear]);

  // 5. Total Tunggakan (Hanya tagihan LALU yang BELUM LUNAS)
  const arrearsStats = useMemo(() => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYearNum = now.getFullYear();

      const overdueBills = bills.filter(b => {
          if (b.status !== 'UNPAID') return false;
          if (b.period_year > currentYearNum) return false;
          if (b.period_year === currentYearNum && b.period_month >= currentMonth) return false;
          return true;
      });

      const totalAmount = overdueBills.reduce((acc, b) => acc + (b.total - (b.paid_amount || 0)), 0);
      return { total: totalAmount };
  }, [bills]);

  // --- CHART 0: TREND ARUS KAS ---
  const chartData = useMemo(() => {
      const data = MONTHS.map(m => ({ name: m.substring(0, 3), income: 0, expense: 0, fullName: m }));
      transactions.forEach(t => {
          const d = new Date(t.date);
          if (d.getFullYear() === dashboardYear) {
              const monthIndex = d.getMonth();
              if (t.type === 'INCOME' && t.category !== 'Saldo Awal') {
                  data[monthIndex].income += t.amount;
              } else if (t.type === 'EXPENSE') {
                  data[monthIndex].expense += t.amount;
              }
          }
      });
      return data;
  }, [transactions, dashboardYear]);

  // --- CHART 2: Alokasi Kas RT (Dari Tagihan Lunas) ---
  const allocationStats = useMemo(() => {
      let collectedIPLKas = 0;
      bills.forEach(b => {
          if (b.status === 'PAID' && b.period_month === dashboardMonth && b.period_year === dashboardYear) {
              collectedIPLKas += (b.ipl_cost || 0) + (b.kas_rt_cost || 0);
          }
      });

      if (collectedIPLKas === 0) return [];
      return [
          { name: 'Kas RT (50%)', value: collectedIPLKas * REVENUE_DISTRIBUTION.RT },
          { name: 'Kas RW (25%)', value: collectedIPLKas * REVENUE_DISTRIBUTION.RW },
          { name: 'DKM (20%)', value: collectedIPLKas * REVENUE_DISTRIBUTION.DKM },
          { name: 'Posyandu (5%)', value: collectedIPLKas * REVENUE_DISTRIBUTION.POSYANDU },
      ].filter(item => item.value > 0);
  }, [bills, dashboardMonth, dashboardYear]);

  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#8B5CF6'];
  const ALLOCATION_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'];

  // Export functions
  const exportChartAsImage = (containerRef: React.RefObject<HTMLDivElement>, fileName: string) => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    const scale = 2;
    canvas.width = svg.clientWidth * scale;
    canvas.height = svg.clientHeight * scale;

    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `${fileName}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const exportDataExcel = (data: any[], fileName: string) => {
    if (data.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-1 gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Dasbor Sistem</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none">Overview Keuangan & Operasional</p>
        </div>
        
        <div className="flex items-center space-x-2 bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm self-start md:self-auto">
            <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500">
                <Calendar size={16} />
            </div>
            <select 
                value={dashboardMonth}
                onChange={(e) => setDashboardMonth(parseInt(e.target.value))}
                className="bg-transparent px-2 py-1 outline-none text-xs font-black text-slate-700 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
            >
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
            <div className="w-[1px] h-4 bg-slate-200"></div>
            <select 
                value={dashboardYear}
                onChange={(e) => setDashboardYear(parseInt(e.target.value))}
                className="bg-transparent px-2 py-1 outline-none text-xs font-black text-slate-700 cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
            >
                <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatsCard 
            title="TOTAL RUMAH" 
            value={totalHouses.toString()} 
            icon={<Home />} 
            color="bg-blue-600"
            onClick={() => navigate('/residents')}
        />
        <StatsCard 
            title="SALDO AKTIF" 
            value={`Rp ${activeBalance.toLocaleString('id-ID')}`} 
            icon={<Wallet />} 
            color="bg-[#1e293b]"
        />
        <StatsCard 
            title="Pemasukan" 
            value={`Rp ${totalIncome.toLocaleString('id-ID')}`} 
            icon={<TrendingUp />} 
            color="bg-emerald-500" 
            onClick={() => navigate('/transactions')}
        />
        <StatsCard 
            title="Pengeluaran" 
            value={`Rp ${totalExpense.toLocaleString('id-ID')}`} 
            icon={<TrendingDown />} 
            color="bg-rose-500"
            onClick={() => navigate('/transactions')} 
        />
        <StatsCard 
            title="TOTAL TUNGGAKAN" 
            value={`Rp ${arrearsStats.total.toLocaleString('id-ID')}`} 
            icon={<AlertCircle />} 
            color="bg-black"
            onClick={() => navigate('/arrears')}
        />
      </div>

      <div className="card p-5 border border-slate-100 shadow-sm relative overflow-visible w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Tren Arus Kas {dashboardYear}</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Transaksi Bulanan (Realtime)</p>
            </div>
            <div className="relative">
              <button onClick={() => setShowExportLine(!showExportLine)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition-all border border-slate-200">
                <Download size={12} /><span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">Ekspor</span><ChevronDown size={10} />
              </button>
              {showExportLine && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <button onClick={() => { exportChartAsImage(lineChartRef, "Tren_Arus_Kas"); setShowExportLine(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-slate-700 text-xs font-bold text-left"><ImageIcon size={16} className="text-blue-500" /> Simpan PNG</button>
                  <button onClick={() => { exportDataExcel(chartData, "Data_Arus_Kas"); setShowExportLine(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-slate-700 text-xs font-bold text-left"><FileText size={16} className="text-emerald-500" /> Unduh Excel</button>
                </div>
              )}
            </div>
          </div>
          <div className="h-64" ref={lineChartRef}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} width={60} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} tickFormatter={(val) => `${(val/1000000).toFixed(1)}M`} />
                <Tooltip cursor={{ stroke: '#f1f5f9', strokeWidth: 2 }} formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`} contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: '800' }} />
                <Line type="monotone" dataKey="income" name="Penerimaan" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="expense" name="Pengeluaran" stroke="#ef4444" strokeWidth={3} dot={{ r: 3, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* REALISASI PEMBAYARAN IURAN */}
          <div className="card p-5 border border-slate-100 shadow-sm relative overflow-visible">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Realisasi Penagihan</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Berdasarkan Tagihan Periode Berjalan</p>
                </div>
                {!isResident && (
                    <div className="relative">
                        <button onClick={() => setShowExportPayment(!showExportPayment)} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition-all border border-slate-200">
                          <Download size={12} /><ChevronDown size={10} />
                        </button>
                        {showExportPayment && (
                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                            <button onClick={() => { exportChartAsImage(piePaymentRef, "Realisasi_Penagihan"); setShowExportPayment(false); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-slate-700 text-[10px] font-bold text-left"><ImageIcon size={14} className="text-blue-500" /> Gambar</button>
                            <button onClick={() => { exportDataExcel(billingStats.pieData, "Data_Realisasi"); setShowExportPayment(false); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-slate-700 text-[10px] font-bold text-left"><FileText size={14} className="text-emerald-500" /> Excel</button>
                        </div>
                        )}
                    </div>
                )}
            </div>

            <div className="h-48 relative" ref={piePaymentRef}>
                {billingStats.pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={billingStats.pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="nominal" stroke="none">
                        {billingStats.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                    </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-300 text-[10px] font-bold italic border-2 border-dashed border-slate-100 rounded-full mx-auto w-48 h-48">Belum ada tagihan</div>
                )}
                {billingStats.pieData.length > 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Lunas</span>
                        <span className={`text-xl font-black ${billingStats.percentagePaidCount === 100 ? 'text-emerald-600' : 'text-slate-800'} leading-none`}>
                            {billingStats.percentagePaidCount.toFixed(0)}%
                        </span>
                    </div>
                )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2">
                {billingStats.pieData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full mr-3 shrink-0" style={{ backgroundColor: item.color }}></div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight truncate leading-none mb-1">{item.name} ({item.value} Unit)</span>
                        <span className="text-[11px] font-black text-slate-800 leading-none">Rp {item.nominal.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] font-black text-slate-400">{((item.nominal / Math.max(1, billingStats.totalTargetNominal)) * 100).toFixed(1)}%</span>
                    </div>
                </div>
                ))}
                {billingStats.totalCount > 0 && (
                    <div className="mt-1 p-2 flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest px-3">
                        <span>Total Target ({billingStats.totalCount} Rumah)</span>
                        <span className="text-slate-600">Rp {billingStats.totalTargetNominal.toLocaleString('id-ID')}</span>
                    </div>
                )}
            </div>
          </div>

          {/* ALOKASI KAS RT */}
          <div className="card p-5 border border-slate-100 shadow-sm relative overflow-visible">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Alokasi Kas RT</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Distribusi dari Iuran Lunas</p>
                </div>
                {!isResident && (
                    <div className="relative">
                        <button onClick={() => setShowExportAllocation(!showExportAllocation)} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition-all border border-slate-200">
                          <Download size={12} /><ChevronDown size={10} />
                        </button>
                        {showExportAllocation && (
                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                            <button onClick={() => { exportChartAsImage(pieAllocationRef, "Alokasi_Kas"); setShowExportAllocation(false); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-slate-700 text-[10px] font-bold text-left"><ImageIcon size={14} className="text-blue-500" /> Gambar</button>
                            <button onClick={() => { exportDataExcel(allocationStats, "Data_Alokasi_Kas"); setShowExportAllocation(false); }} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 text-slate-700 text-[10px] font-bold text-left"><FileText size={14} className="text-emerald-500" /> Excel</button>
                        </div>
                        )}
                    </div>
                )}
            </div>

            <div className="h-48 relative" ref={pieAllocationRef}>
                {allocationStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={allocationStats} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value" stroke="none">
                        {allocationStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} />
                        ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                    </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-300 text-[10px] font-bold italic border-2 border-dashed border-slate-100 rounded-full mx-auto w-48 h-48">Menunggu Iuran Lunas</div>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <PieChartIcon size={20} className="text-slate-300 mb-1" />
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-widest leading-none">Alokasi</span>
                </div>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-2">
                {allocationStats.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length] }}></div>
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-tight truncate">{item.name}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-semibold text-slate-800">Rp {item.value.toLocaleString('id-ID')}</span>
                    </div>
                </div>
                ))}
            </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
