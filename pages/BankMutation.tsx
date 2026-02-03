
import React, { useState, useMemo } from 'react';
import { 
  Landmark, 
  Search, 
  Calendar, 
  Building2, 
  TrendingUp,
  TrendingDown,
  PieChart,
  Filter,
  Info
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MONTHS } from '../constants';

const BankMutationPage: React.FC = () => {
  const { bankAccounts, transactions } = useApp();
  
  const today = new Date();
  const [filterDay, setFilterDay] = useState<number | 'ALL'>('ALL');
  const [filterMonth, setFilterMonth] = useState<number>(today.getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(today.getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string>('ALL');

  // Convert transactions (Transfer only) to Mutation format
  const filteredMutations = useMemo(() => {
      return transactions.filter(t => {
          // Filter transfer only
          if (t.paymentMethod !== 'TRANSFER' || !t.bankAccountId) return false;
          
          // Bank filter
          if (selectedBankId !== 'ALL' && t.bankAccountId !== selectedBankId) return false;
          
          // Date Filter
          const [y, m, d] = t.date.split('-').map(Number);
          if (filterYear !== y) return false;
          if (filterMonth !== m) return false;
          if (filterDay !== 'ALL' && filterDay !== d) return false;
          
          // Search term
          if (searchQuery && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
          
          return true;
      }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filterDay, filterMonth, filterYear, searchQuery, selectedBankId]);

  const summary = useMemo(() => {
      const masuk = filteredMutations.filter(m => m.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
      const keluar = filteredMutations.filter(m => m.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
      return { masuk, keluar, neto: masuk - keluar };
  }, [filteredMutations]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Mutasi Rekening Bank</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Rekapitulasi Transaksi Non-Tunai (Transfer)</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-8 bg-white border border-slate-100 shadow-sm rounded-[2.5rem]">
          <div className="flex flex-wrap gap-6 items-end">
              <div className="flex-1 min-w-[240px]">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2">
                      Pilih Rekening
                      <div className="group relative">
                          <Info size={14} className="text-slate-300 cursor-help" />
                          <div className="absolute left-0 bottom-full mb-3 hidden group-hover:block w-56 p-4 bg-slate-900 text-white text-[10px] font-bold rounded-2xl shadow-2xl z-[60] animate-in fade-in slide-in-from-bottom-2">
                            Cek Manajemen Bank di Pengaturan untuk mengelola data rekening.
                          </div>
                      </div>
                  </label>
                  <select 
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none focus:border-blue-500 transition-all cursor-pointer"
                  >
                      <option value="ALL">Semua Rekening Bank</option>
                      {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>)}
                  </select>
              </div>
              
              <div className="w-24">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Hari</label>
                  <select 
                    value={filterDay}
                    onChange={(e) => setFilterDay(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none"
                  >
                      <option value="ALL">Semua</option>
                      {Array.from({length: 31}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                  </select>
              </div>

              <div className="w-36">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Bulan</label>
                  <select 
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none"
                  >
                      {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
              </div>

              <div className="w-28">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Tahun</label>
                  <select 
                    value={filterYear}
                    onChange={(e) => setFilterYear(parseInt(e.target.value))}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none"
                  >
                      <option value={today.getFullYear()}>{today.getFullYear()}</option>
                  </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Cari Keterangan</label>
                  <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cari transaksi..."
                        className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs outline-none focus:bg-white"
                      />
                  </div>
              </div>
          </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[2.5rem] flex justify-between items-center shadow-sm">
              <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Total Masuk (Debit)</p>
                  <h3 className="text-3xl font-black text-emerald-700">Rp {summary.masuk.toLocaleString('id-ID')}</h3>
              </div>
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-md shadow-emerald-900/5"><TrendingUp size={28}/></div>
          </div>
          <div className="p-8 bg-rose-50 border border-rose-100 rounded-[2.5rem] flex justify-between items-center shadow-sm">
              <div>
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-2">Total Keluar (Kredit)</p>
                  <h3 className="text-3xl font-black text-rose-700">Rp {summary.keluar.toLocaleString('id-ID')}</h3>
              </div>
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-md shadow-rose-900/5"><TrendingDown size={28}/></div>
          </div>
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-[2.5rem] flex justify-between items-center text-white shadow-2xl">
              <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Saldo {MONTHS[filterMonth - 1]}</p>
                  <h3 className="text-3xl font-black">Rp {summary.neto.toLocaleString('id-ID')}</h3>
              </div>
              <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400"><PieChart size={28}/></div>
          </div>
      </div>

      {/* Mutation List Table */}
      <div className="card bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px] rounded-[3rem]">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Detail Mutasi Transaksi Bank</h3>
              <span className="bg-white px-4 py-1.5 rounded-full border border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredMutations.length} Transaksi</span>
          </div>
          <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                      <tr>
                          <th className="px-8 py-6">Tanggal</th>
                          <th className="px-8 py-6">Keterangan / Deskripsi</th>
                          <th className="px-8 py-6">Rekening Tujuan</th>
                          <th className="px-8 py-6 text-right">Debit (+)</th>
                          <th className="px-8 py-6 text-right">Kredit (-)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredMutations.length > 0 ? filteredMutations.map(m => {
                          const bank = bankAccounts.find(b => b.id === m.bankAccountId);
                          return (
                            <tr key={m.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-8 py-6 text-xs font-black text-slate-500">{m.date.split('-').reverse().join('/')}</td>
                                <td className="px-8 py-6">
                                    <p className="text-sm font-black text-slate-700 leading-tight mb-1">{m.description}</p>
                                    <span className="text-[9px] font-black bg-slate-100 text-slate-400 px-2 py-0.5 rounded uppercase tracking-wider">{m.category}</span>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-[10px] font-black text-indigo-500 border border-indigo-100 shadow-sm">{bank?.bankName.charAt(0) || '?'}</div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-slate-700 uppercase">{bank?.bankName || 'Unknown'}</span>
                                            <span className="text-[9px] font-bold text-slate-400">{bank?.accountNumber || '-'}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right font-black text-emerald-600 text-base">
                                    {m.type === 'INCOME' ? `+ Rp ${m.amount.toLocaleString('id-ID')}` : '-'}
                                </td>
                                <td className="px-8 py-6 text-right font-black text-rose-600 text-base">
                                    {m.type === 'EXPENSE' ? `- Rp ${m.amount.toLocaleString('id-ID')}` : '-'}
                                </td>
                            </tr>
                          )
                      }) : (
                        <tr>
                            <td colSpan={5} className="px-8 py-32 text-center text-slate-400">
                                <div className="flex flex-col items-center justify-center opacity-20">
                                    <Landmark size={80} className="mb-6 text-slate-300" />
                                    <p className="text-sm font-black uppercase tracking-[0.4em]">Belum ada mutasi bank ditemukan</p>
                                    <p className="text-[10px] font-bold mt-4">Sesuaikan filter atau pastikan transaksi menggunakan metode 'TRANSFER'</p>
                                </div>
                            </td>
                        </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default BankMutationPage;
