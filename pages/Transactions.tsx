
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Search, 
  Calendar, 
  Download, 
  Upload, 
  Trash2, 
  Plus, 
  Minus,
  FileText,
  Printer,
  ChevronDown,
  X,
  Save,
  Loader2,
  Wallet,
  FileSpreadsheet,
  Edit,
  Landmark,
  PieChart
} from 'lucide-react';
import { MONTHS } from '../constants';
import { Transaction } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Transactions: React.FC = () => {
  const { transactions, deleteTransaction, addTransaction, updateTransaction, settings, addNotification, bankAccounts, currentUser, triggerPopup } = useApp();
  
  const [activeTab, setActiveTab] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const currentRealMonth = new Date().getMonth() + 1;
  const currentRealYear = new Date().getFullYear();
  
  const [dateFilter, setDateFilter] = useState({ month: currentRealMonth, year: currentRealYear });
  
  // PDF Option State
  const [showPdfOptions, setShowPdfOptions] = useState(false);

  // Input Modal State
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputType, setInputType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [editingId, setEditingId] = useState<string | null>(null); 
  const [inputData, setInputData] = useState({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      category: '',
      description: '',
      paymentMethod: 'CASH' as 'CASH' | 'TRANSFER',
      bankAccountId: ''
  });

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailType, setDetailType] = useState<'INITIAL' | 'INCOME' | 'EXPENSE'>('INITIAL');

  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // TRIGGER WARNING MODAL ON PAGE LOAD
  useEffect(() => {
    const hasSeenReminder = sessionStorage.getItem('hasSeenTransactionReminder');
    if (!hasSeenReminder) {
        triggerPopup({
            title: 'Pengingat Penting',
            message: 'PASTIKAN ANDA SUDAH MELAKUKAN UPDATE SALDO DAN DATA REKENING BANK SEBELUM MELAKUKAN INPUT DATA TRANSAKSI',
            type: 'DATA'
        });
        sessionStorage.setItem('hasSeenTransactionReminder', 'true');
    }
  }, [triggerPopup]);

  // FINANCIAL SUMMARY LOGIC
  const summary = useMemo(() => {
      const targetYear = dateFilter.year;
      const targetMonth = dateFilter.month;

      // 1. Calculate Beginning Cash Position
      const baseCash = settings.cash_initial_balance || 0;
      const previousTransactions = transactions.filter(t => {
          const [y, m, d] = t.date.split('-').map(Number);
          return y < targetYear || (y === targetYear && m < targetMonth);
      });
      const prevCashFlow = previousTransactions.filter(t => t.paymentMethod === 'CASH' && t.category !== 'Saldo Awal');
      const pcInc = prevCashFlow.filter(t => t.type === 'INCOME').reduce((s,t) => s + t.amount, 0);
      const pcExp = prevCashFlow.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);
      const startCash = baseCash + pcInc - pcExp;

      // 2. Calculate Beginning Bank Position
      let startBankTotal = 0;
      const bankBreakdown: { name: string, no: string, amount: number }[] = [];
      bankAccounts.forEach(acc => {
          const futureTx = transactions.filter(t => {
              if (t.paymentMethod !== 'TRANSFER' || t.bankAccountId !== acc.id) return false;
              const [y, m, d] = t.date.split('-').map(Number);
              return y > targetYear || (y === targetYear && m >= targetMonth);
          });
          const fInc = futureTx.filter(t => t.type === 'INCOME').reduce((s,t) => s + t.amount, 0);
          const fExp = futureTx.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);
          const bankAtStart = acc.balance - fInc + fExp;
          startBankTotal += bankAtStart;
          bankBreakdown.push({ name: acc.bankName, no: acc.accountNumber, amount: bankAtStart });
      });

      const initialBalance = startCash + startBankTotal;
      const currentMonthTx = transactions.filter(t => {
          const [y, m, d] = t.date.split('-').map(Number);
          return m === targetMonth && y === targetYear && t.category !== 'Saldo Awal';
      });
      const totalIncome = currentMonthTx.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = currentMonthTx.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
      const finalBalance = initialBalance + totalIncome - totalExpense;

      return { initialBalance, totalIncome, totalExpense, finalBalance, startCash, startBankTotal, bankBreakdown };
  }, [transactions, dateFilter, settings.cash_initial_balance, bankAccounts]);

  const currentPeriodTransactions = useMemo(() => {
      return transactions.filter(t => {
          const [y, m, d] = t.date.split('-').map(Number);
          const matchesPeriod = m === dateFilter.month && y === dateFilter.year;
          const matchesTab = activeTab === 'ALL' || t.type === activeTab;
          const searchLower = searchTerm.toLowerCase();
          const matchesSearch = t.description.toLowerCase().includes(searchLower) || t.category.toLowerCase().includes(searchLower);
          return matchesPeriod && matchesTab && matchesSearch && t.category !== 'Saldo Awal';
      }).sort((a,b) => b.date.localeCompare(a.date)); 
  }, [transactions, activeTab, dateFilter, searchTerm]);

  const detailData = useMemo(() => {
      if (detailType === 'INITIAL') {
          const items = [
            { label: 'Saldo Tunai (Kas)', amount: summary.startCash, isHeader: true },
            { label: 'Saldo Di Bank (Total)', amount: summary.startBankTotal, isHeader: true },
            ...summary.bankBreakdown.map(b => ({ label: `${b.name} (${b.no})`, amount: b.amount, isSub: true }))
          ];
          return { title: 'Rincian Saldo Awal', items, total: summary.initialBalance };
      } 
      const type = detailType;
      const relevantTx = currentPeriodTransactions.filter(t => t.type === type);
      const grouped: Record<string, number> = {};
      relevantTx.forEach(t => { grouped[t.category] = (grouped[t.category] || 0) + t.amount; });
      const items = Object.entries(grouped).map(([label, amount]) => ({ label, amount, isHeader: false }));
      return { title: type === 'INCOME' ? 'Rincian Pemasukan' : 'Rincian Pengeluaran', items, total: items.reduce((acc, curr) => acc + curr.amount, 0) };
  }, [detailType, summary, currentPeriodTransactions]);

  const handleOpenDetail = (type: 'INITIAL' | 'INCOME' | 'EXPENSE') => { setDetailType(type); setShowDetailModal(true); };

  const handleDelete = async (id: string) => { if (window.confirm("Yakin ingin menghapus transaksi ini?")) await deleteTransaction(id); };

  return (
    <div className="space-y-4 pb-0 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
        <div><h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Buku Kas Harian</h2><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Pencatatan Transaksi Operasional</p></div>
        <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
                <select value={dateFilter.month} onChange={(e) => setDateFilter({...dateFilter, month: parseInt(e.target.value)})} className="bg-transparent px-2 py-1 text-[11px] font-black outline-none cursor-pointer">{MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}</select>
                <div className="w-[1px] h-3 bg-slate-200"></div>
                <select value={dateFilter.year} onChange={(e) => setDateFilter({...dateFilter, year: parseInt(e.target.value)})} className="bg-transparent px-2 py-1 text-[11px] font-black outline-none cursor-pointer"><option value={currentRealYear}>{currentRealYear}</option></select>
            </div>
            <button onClick={() => setInputType('EXPENSE')} className="px-3 py-2 bg-rose-600 text-white rounded-lg font-black text-[9px] uppercase tracking-widest shadow-sm"><Minus size={12} strokeWidth={4} /></button>
            <button onClick={() => setInputType('INCOME')} className="px-3 py-2 bg-emerald-600 text-white rounded-lg font-black text-[9px] uppercase tracking-widest shadow-sm"><Plus size={12} strokeWidth={4} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          {[
              { type: 'INITIAL', label: 'Saldo Awal', amount: summary.initialBalance, icon: <Wallet size={16} />, color: 'indigo' },
              { type: 'INCOME', label: 'Pemasukan', amount: summary.totalIncome, icon: <Upload size={16} />, color: 'emerald' },
              { type: 'EXPENSE', label: 'Pengeluaran', amount: summary.totalExpense, icon: <Download size={16} />, color: 'rose' },
              { type: 'FINAL', label: 'Saldo Akhir', amount: summary.finalBalance, icon: <PieChart size={16} />, color: 'slate', isSpecial: true }
          ].map(card => (
              <button key={card.label} onClick={card.type !== 'FINAL' ? () => handleOpenDetail(card.type as any) : undefined} className={`p-4 border rounded-[1.75rem] text-left transition-all ${card.isSpecial ? 'bg-slate-900 border-slate-800 text-white' : `bg-${card.color}-50/50 border-${card.color}-100 hover:shadow-md`}`}>
                  <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${card.isSpecial ? 'text-slate-400' : `text-${card.color}-400`}`}>{card.label}</p>
                  <h3 className={`text-base font-black truncate ${card.isSpecial ? 'text-white' : `text-${card.color}-700`}`}>Rp {card.amount.toLocaleString()}</h3>
              </button>
          ))}
      </div>

      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                {['ALL', 'INCOME', 'EXPENSE'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{tab === 'ALL' ? 'Semua' : tab === 'INCOME' ? 'Masuk' : 'Keluar'}</button>
                ))}
            </div>
            <div className="relative w-48"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} /><input type="text" placeholder="Cari..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none" /></div>
          </div>
          <div className="overflow-auto flex-1 relative sticky-header"><table className="w-full text-left"><thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><tr><th className="px-5 py-3.5">Tanggal</th><th className="px-5 py-3.5">Keterangan</th><th className="px-5 py-3.5 text-center">Metode</th><th className="px-5 py-3.5 text-right">Jumlah (IDR)</th><th className="px-5 py-3.5 text-center">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white">{currentPeriodTransactions.length > 0 ? (currentPeriodTransactions.map(t => {
              const bank = t.paymentMethod === 'TRANSFER' ? bankAccounts.find(b => b.id === t.bankAccountId) : null;
              return (<tr key={t.id} className="hover:bg-slate-50/50 transition-colors group"><td className="px-5 py-3 text-[10px] font-black text-slate-500">{t.date.split('-').reverse().join('/')}</td><td className="px-5 py-3 text-xs font-bold text-slate-700">{t.description}<br/><span className="text-[8px] font-black uppercase text-slate-300 tracking-wider">{t.category}</span></td><td className="px-5 py-3 text-center"><div className="flex flex-col items-center"><span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${t.paymentMethod === 'TRANSFER' ? 'text-blue-500 border-blue-100 bg-blue-50' : 'text-slate-400 border-slate-100 bg-slate-50'}`}>{t.paymentMethod}</span>{bank && <span className="text-[7px] font-black text-blue-300 uppercase truncate max-w-[60px]">{bank.bankName}</span>}</div></td><td className={`px-5 py-3 text-right font-black text-xs ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>Rp {t.amount.toLocaleString()}</td><td className="px-5 py-3 text-center"><button onClick={() => handleDelete(t.id)} className="p-1.5 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button></td></tr>);
          })) : (<tr><td colSpan={5} className="px-6 py-16 text-center text-slate-300 text-xs italic">Tidak ada transaksi</td></tr>)}</tbody></table></div>
      </div>

      {showDetailModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                  <div className={`p-5 flex justify-between items-center ${detailType === 'INITIAL' ? 'bg-indigo-600' : detailType === 'INCOME' ? 'bg-emerald-600' : 'bg-rose-600'} text-white shrink-0`}><div><h3 className="font-black text-base uppercase tracking-widest">{detailData.title}</h3><p className="text-[9px] font-bold opacity-60 uppercase">{MONTHS[dateFilter.month-1]} {dateFilter.year}</p></div><button onClick={() => setShowDetailModal(false)} className="p-1.5 bg-white/10 rounded-full"><X size={16} /></button></div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {detailData.items.length > 0 ? (
                        <div className="space-y-4">
                            {detailData.items.map((item: any, idx) => (
                                <div key={idx} className={`flex justify-between items-center ${item.isHeader ? 'border-b border-slate-100 pb-2 font-black text-slate-800 text-[12px]' : item.isSub ? 'text-[11px] font-bold text-slate-400 pl-4 border-l-2 border-slate-50 py-1' : 'text-[11px] font-bold text-slate-600'}`}>
                                    <span>{item.label}</span>
                                    <span className={item.isHeader ? 'text-slate-900' : 'text-slate-400'}>Rp {item.amount.toLocaleString('id-ID')}</span>
                                </div>
                            ))}
                        </div>
                    ) : (<div className="text-center py-10 text-[10px] font-black uppercase text-slate-300 italic">Belum ada data</div>)}
                  </div>
                  <div className="p-5 bg-slate-50 border-t border-slate-100 shrink-0 text-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">TOTAL KESELURUHAN</span><span className={`text-2xl font-black ${detailType === 'INITIAL' ? 'text-indigo-600' : detailType === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>Rp {detailData.total.toLocaleString('id-ID')}</span></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Transactions;
