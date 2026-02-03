
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  FilePieChart, 
  Calendar, 
  Download, 
  FileSpreadsheet, 
  Wallet, 
  Landmark, 
  ArrowDownCircle, 
  Search,
  ChevronDown
} from 'lucide-react';
import { MONTHS } from '../constants';
import * as XLSX from 'xlsx';

const ExpenseRecap: React.FC = () => {
  const { transactions, settings } = useApp();
  
  const currentRealMonth = new Date().getMonth() + 1;
  const currentRealYear = new Date().getFullYear();
  
  const [dateFilter, setDateFilter] = useState({ month: currentRealMonth, year: currentRealYear });
  const [searchTerm, setSearchTerm] = useState('');

  // --- CALCULATION LOGIC ---
  const recapData = useMemo(() => {
      // 1. Filter pengeluaran saja pada periode tertentu
      const expenses = transactions.filter(t => {
          const d = new Date(t.date);
          return d.getMonth() + 1 === dateFilter.month && 
                 d.getFullYear() === dateFilter.year && 
                 t.type === 'EXPENSE';
      });

      // 2. Kelompokkan per Kategori
      const grouped: Record<string, { cash: number, transfer: number, total: number }> = {};
      
      expenses.forEach(t => {
          if (!grouped[t.category]) {
              grouped[t.category] = { cash: 0, transfer: 0, total: 0 };
          }
          if (t.paymentMethod === 'CASH') {
              grouped[t.category].cash += t.amount;
          } else {
              grouped[t.category].transfer += t.amount;
          }
          grouped[t.category].total += t.amount;
      });

      // 3. Konversi ke Array dan filter pencarian
      return Object.entries(grouped)
          .map(([name, vals]) => ({ name, ...vals }))
          .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
          .sort((a, b) => b.total - a.total);
  }, [transactions, dateFilter, searchTerm]);

  const totals = useMemo(() => {
      const cash = recapData.reduce((s, i) => s + i.cash, 0);
      const transfer = recapData.reduce((s, i) => s + i.transfer, 0);
      return { totalCashOut: cash, totalTransferOut: transfer, grandTotal: cash + transfer };
  }, [recapData]);

  const exportExcel = () => {
      const exportData = recapData.map(item => ({
          'Kategori': item.name,
          'Tunai (CASH)': item.cash,
          'Transfer (BANK)': item.transfer,
          'Total Pengeluaran': item.total
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rekap Pengeluaran");
      XLSX.writeFile(wb, `Rekap_Pengeluaran_${MONTHS[dateFilter.month-1]}_${dateFilter.year}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Rekap Pengeluaran</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">RINGKASAN PENGELUARAN TUNAI & TRANSFER</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                <select 
                    value={dateFilter.month}
                    onChange={(e) => setDateFilter({...dateFilter, month: parseInt(e.target.value)})}
                    className="bg-transparent px-3 py-2 text-xs font-bold outline-none cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
                >
                    {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <div className="w-[1px] h-4 bg-slate-200"></div>
                <select 
                    value={dateFilter.year}
                    onChange={(e) => setDateFilter({...dateFilter, year: parseInt(e.target.value)})}
                    className="bg-transparent px-3 py-2 text-xs font-bold outline-none cursor-pointer hover:bg-slate-50 rounded-lg transition-colors"
                >
                    <option value={currentRealYear}>{currentRealYear}</option>
                    <option value={currentRealYear-1}>{currentRealYear-1}</option>
                </select>
            </div>

            <button 
                onClick={exportExcel}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2"
            >
                <FileSpreadsheet size={14} /> EXPORT EXCEL
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center shrink-0">
                  <Wallet size={24} />
              </div>
              <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Tunai (Cash Out)</p>
                  <h3 className="text-xl font-black text-slate-800">Rp {totals.totalCashOut.toLocaleString('id-ID')}</h3>
              </div>
          </div>

          <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Landmark size={24} />
              </div>
              <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Transfer (Bank Out)</p>
                  <h3 className="text-xl font-black text-blue-600">Rp {totals.totalTransferOut.toLocaleString('id-ID')}</h3>
              </div>
          </div>

          <div className="p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center shrink-0">
                  <ArrowDownCircle size={24} />
              </div>
              <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pengeluaran</p>
                  <h3 className="text-xl font-black">Rp {totals.grandTotal.toLocaleString('id-ID')}</h3>
              </div>
          </div>
      </div>

      <div className="card bg-white border border-slate-100 shadow-sm rounded-[2rem] overflow-hidden flex flex-col min-h-[400px]">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Detail Per Kategori</h3>
              <div className="relative w-full sm:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                      type="text" 
                      placeholder="Cari kategori..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-full text-xs font-bold outline-none focus:border-slate-800 transition-all"
                  />
              </div>
          </div>

          <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                      <tr>
                          <th className="px-8 py-5">Kategori Pengeluaran</th>
                          <th className="px-8 py-5 text-right">Tunai (CASH)</th>
                          <th className="px-8 py-5 text-right">Transfer (BANK)</th>
                          <th className="px-8 py-5 text-right bg-slate-50/50">Total</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {recapData.length > 0 ? (
                          recapData.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-8 py-5">
                                      <p className="text-sm font-bold text-slate-700">{item.name}</p>
                                  </td>
                                  <td className="px-8 py-5 text-right font-bold text-slate-500">
                                      {item.cash > 0 ? `Rp ${item.cash.toLocaleString('id-ID')}` : '-'}
                                  </td>
                                  <td className="px-8 py-5 text-right font-bold text-blue-500">
                                      {item.transfer > 0 ? `Rp ${item.transfer.toLocaleString('id-ID')}` : '-'}
                                  </td>
                                  <td className="px-8 py-5 text-right font-black text-slate-800 bg-slate-50/30">
                                      Rp {item.total.toLocaleString('id-ID')}
                                  </td>
                              </tr>
                          ))
                      ) : (
                          <tr>
                              <td colSpan={4} className="px-8 py-24 text-center">
                                  <div className="flex flex-col items-center justify-center opacity-30">
                                      <FilePieChart size={48} className="text-slate-400 mb-4" />
                                      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                                          Belum ada data pengeluaran
                                      </p>
                                  </div>
                              </td>
                          </tr>
                      )}
                  </tbody>
                  {recapData.length > 0 && (
                      <tfoot className="bg-slate-900 text-white">
                          <tr>
                              <td className="px-8 py-5 font-black uppercase text-xs">Total Keseluruhan</td>
                              <td className="px-8 py-5 text-right font-black">Rp {totals.totalCashOut.toLocaleString('id-ID')}</td>
                              <td className="px-8 py-5 text-right font-black">Rp {totals.totalTransferOut.toLocaleString('id-ID')}</td>
                              <td className="px-8 py-5 text-right font-black text-emerald-400 text-base">Rp {totals.grandTotal.toLocaleString('id-ID')}</td>
                          </tr>
                      </tfoot>
                  )}
              </table>
          </div>
      </div>
    </div>
  );
};

export default ExpenseRecap;
