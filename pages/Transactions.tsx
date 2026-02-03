
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
  PieChart,
  CheckCircle2,
  FileUp,
  ArrowRight,
  Filter
} from 'lucide-react';
import { MONTHS } from '../constants';
import { Transaction } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Transactions: React.FC = () => {
  const { 
    transactions, 
    deleteTransaction, 
    addTransaction, 
    updateTransaction, 
    settings, 
    addNotification, 
    bankAccounts, 
    triggerPopup,
    currentUser
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const firstDayOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

  // Filter Mode State
  const [filterMode, setFilterMode] = useState<'DAILY' | 'MONTHLY'>('MONTHLY');
  
  // Daily Filter State
  const [dailyFilter, setDailyFilter] = useState({ 
    startDate: firstDayOfMonth,
    endDate: today.toISOString().split('T')[0]
  });

  // Monthly Filter State
  const [monthlyFilter, setMonthlyFilter] = useState({
    month: currentMonth,
    year: currentYear
  });
  
  // Modal States
  const [showInputModal, setShowInputModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPdfDropdown, setShowPdfDropdown] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category: '',
    description: '',
    paymentMethod: 'CASH' as 'CASH' | 'TRANSFER',
    bankAccountId: ''
  });

  // Handlers
  const handleOpenAdd = (type: 'INCOME' | 'EXPENSE') => {
    setEditingId(null);
    setInputType(type);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      category: '',
      description: '',
      paymentMethod: 'CASH',
      bankAccountId: ''
    });
    setShowInputModal(true);
  };

  const handleOpenEdit = (t: Transaction) => {
    setEditingId(t.id);
    setInputType(t.type);
    setFormData({
      date: t.date,
      amount: t.amount.toString(),
      category: t.category,
      description: t.description,
      paymentMethod: t.paymentMethod,
      bankAccountId: t.bankAccountId || ''
    });
    setShowInputModal(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.category) return;
    
    setIsSubmitting(true);
    try {
      const payload: Transaction = {
        id: editingId || `tr-${Date.now()}`,
        date: formData.date,
        type: inputType,
        category: formData.category,
        amount: parseInt(formData.amount),
        description: formData.description,
        paymentMethod: formData.paymentMethod,
        bankAccountId: formData.paymentMethod === 'TRANSFER' ? formData.bankAccountId : undefined
      };

      if (editingId) {
        await updateTransaction(payload);
      } else {
        await addTransaction(payload);
      }
      setShowInputModal(false);
    } catch (err) {
      addNotification("Gagal memproses transaksi", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

        let count = 0;
        for (const row of jsonData) {
          if (row.JUMLAH && row.KATEGORI) {
            const date = row.TANGGAL ? (typeof row.TANGGAL === 'number' ? new Date((row.TANGGAL - 25569) * 86400 * 1000).toISOString().split('T')[0] : row.TANGGAL) : new Date().toISOString().split('T')[0];
            const type = String(row.TIPE).toUpperCase() === 'INCOME' || String(row.TIPE).toUpperCase() === 'MASUK' ? 'INCOME' : 'EXPENSE';
            
            await addTransaction({
              id: `imp-${Date.now()}-${Math.random()}`,
              date,
              type,
              category: row.KATEGORI,
              amount: parseInt(row.JUMLAH),
              description: row.KETERANGAN || '-',
              paymentMethod: String(row.METODE).toUpperCase() === 'TRANSFER' ? 'TRANSFER' : 'CASH',
              bankAccountId: row.BANK_ID || undefined
            });
            count++;
          }
        }
        addNotification(`${count} transaksi berhasil diimpor`, "success");
        setShowImportModal(false);
      } catch (err) {
        addNotification("Format file tidak didukung", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const template = [
      { TANGGAL: '2025-01-01', TIPE: 'INCOME', KATEGORI: 'Iuran Warga', JUMLAH: 150000, KETERANGAN: 'Contoh Pemasukan', METODE: 'CASH', BANK_ID: '' },
      { TANGGAL: '2025-01-02', TIPE: 'EXPENSE', KATEGORI: 'Listrik', JUMLAH: 50000, KETERANGAN: 'Contoh Pengeluaran', METODE: 'TRANSFER', BANK_ID: 'ID_BANK' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_transaksi.xlsx");
  };

  const generatePDF = (exportType: string) => {
    const doc = new jsPDF();
    const filterDesc = filterMode === 'DAILY' 
        ? `${dailyFilter.startDate} s/d ${dailyFilter.endDate}`
        : `${MONTHS[monthlyFilter.month-1]} ${monthlyFilter.year}`;
    
    doc.setFontSize(16);
    doc.text("BUKU KAS HARIAN", 14, 15);
    doc.setFontSize(10);
    doc.text(`${settings.location_name} | Laporan: ${filterDesc}`, 14, 22);

    const data = filteredTransactions.map(t => [
      t.date,
      t.category,
      t.description,
      t.paymentMethod,
      t.type === 'INCOME' ? `+Rp ${t.amount.toLocaleString()}` : `-Rp ${t.amount.toLocaleString()}`
    ]);

    autoTable(doc, {
      head: [['Tanggal', 'Kategori', 'Keterangan', 'Metode', 'Jumlah']],
      body: data,
      startY: 30,
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Total Masuk: Rp ${summary.totalIncome.toLocaleString()}`, 14, finalY);
    doc.text(`Total Keluar: Rp ${summary.totalExpense.toLocaleString()}`, 14, finalY + 7);
    doc.setFontSize(11);
    doc.text(`Saldo Akhir: Rp ${summary.finalBalance.toLocaleString()}`, 14, finalY + 15);

    doc.save(`Kas_${filterDesc.replace(/-/g, '').replace(/\s/g, '_')}.pdf`);
  };

  // Calculations Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      let isWithinDate = false;
      const [y, m, d] = t.date.split('-').map(Number);

      if (filterMode === 'DAILY') {
          isWithinDate = t.date >= dailyFilter.startDate && t.date <= dailyFilter.endDate;
      } else {
          isWithinDate = y === monthlyFilter.year && m === monthlyFilter.month;
      }

      let matchesTab = false;
      if (activeTab === 'ALL') matchesTab = true;
      else if (activeTab === 'INCOME') matchesTab = t.type === 'INCOME';
      else if (activeTab === 'EXPENSE') matchesTab = t.type === 'EXPENSE';
      else if (activeTab === 'CASH') matchesTab = t.paymentMethod === 'CASH';
      else if (activeTab === 'TRANSFER') matchesTab = t.paymentMethod === 'TRANSFER';
      else if (activeTab.startsWith('BANK_')) {
          matchesTab = t.paymentMethod === 'TRANSFER' && t.bankAccountId === activeTab.replace('BANK_', '');
      }

      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      return isWithinDate && matchesTab && matchesSearch;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filterMode, dailyFilter, monthlyFilter, activeTab, searchTerm]);

  const summary = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    
    // Initial balance logic
    const filterStart = filterMode === 'DAILY' ? dailyFilter.startDate : `${monthlyFilter.year}-${String(monthlyFilter.month).padStart(2, '0')}-01`;
    const prevTransactions = transactions.filter(t => t.date < filterStart);

    const prevInc = prevTransactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const prevExp = prevTransactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const baseBalance = (settings.cash_initial_balance || 0) + prevInc - prevExp;

    return { 
      totalIncome: income, 
      totalExpense: expense, 
      initialBalance: baseBalance,
      finalBalance: baseBalance + income - expense 
    };
  }, [transactions, filteredTransactions, dailyFilter, monthlyFilter, filterMode, settings.cash_initial_balance]);

  return (
    <div className="space-y-4 pb-0 animate-in fade-in duration-500 h-full flex flex-col">
      {/* Header & Advanced Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0 px-1 py-2">
        <div className="flex flex-col">
            <h2 className="text-2xl font-black text-[#1e293b] tracking-tight leading-none mb-1">Buku Kas Harian</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Pencatatan Pemasukan & Pengeluaran Operasional</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            {/* Filter Toggle & Inputs */}
            <div className="flex items-center bg-white border border-slate-200 rounded-[0.85rem] p-1.5 shadow-sm">
                <div className="flex bg-slate-50 p-1 rounded-lg mr-2 border border-slate-100">
                    <button 
                        onClick={() => setFilterMode('DAILY')} 
                        className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all ${filterMode === 'DAILY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >Harian</button>
                    <button 
                        onClick={() => setFilterMode('MONTHLY')} 
                        className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all ${filterMode === 'MONTHLY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >Bulanan</button>
                </div>

                {filterMode === 'DAILY' ? (
                    <div className="flex items-center">
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dari</span>
                            <input 
                              type="date" 
                              value={dailyFilter.startDate} 
                              onChange={(e) => setDailyFilter({...dailyFilter, startDate: e.target.value})}
                              className="bg-transparent text-[10px] font-black text-slate-700 outline-none cursor-pointer" 
                            />
                        </div>
                        <div className="w-[1px] h-4 bg-slate-300 mx-1"></div>
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sampai</span>
                            <input 
                              type="date" 
                              value={dailyFilter.endDate} 
                              onChange={(e) => setDailyFilter({...dailyFilter, endDate: e.target.value})}
                              className="bg-transparent text-[10px] font-black text-slate-700 outline-none cursor-pointer" 
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center">
                        <div className="relative group">
                            <select 
                                value={monthlyFilter.month} 
                                onChange={(e) => setMonthlyFilter({...monthlyFilter, month: parseInt(e.target.value)})} 
                                className="bg-transparent pl-3 pr-8 py-1 text-[10px] font-black text-slate-700 outline-none cursor-pointer appearance-none"
                            >
                                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" strokeWidth={3} />
                        </div>
                        <div className="w-[1px] h-3 bg-slate-300 mx-1"></div>
                        <div className="relative group">
                            <select 
                                value={monthlyFilter.year} 
                                onChange={(e) => setMonthlyFilter({...monthlyFilter, year: parseInt(e.target.value)})} 
                                className="bg-transparent pl-3 pr-8 py-1 text-[10px] font-black text-slate-700 outline-none cursor-pointer appearance-none"
                            >
                                <option value={currentYear}>{currentYear}</option>
                                <option value={currentYear - 1}>{currentYear - 1}</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" strokeWidth={3} />
                        </div>
                    </div>
                )}
            </div>

            <button 
              onClick={() => setShowImportModal(true)}
              className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              title="Import Data"
            >
                <Upload size={18} />
            </button>

            <div className="relative">
                <button 
                    onClick={() => setShowPdfDropdown(!showPdfDropdown)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#fef2f2] border border-[#fecaca] text-[#e11d48] rounded-[0.75rem] shadow-sm transition-all active:scale-95"
                >
                    <Printer size={18} strokeWidth={2.5} />
                    <span className="text-[10px] font-black uppercase tracking-widest">PDF</span>
                </button>
                {showPdfDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button onClick={() => generatePDF('ALL')} className="w-full text-left px-5 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">Semua Transaksi</button>
                        <button onClick={() => generatePDF('INCOME')} className="w-full text-left px-5 py-2.5 text-[11px] font-black text-[#059669] hover:bg-emerald-50">Pemasukan Saja</button>
                        <button onClick={() => generatePDF('EXPENSE')} className="w-full text-left px-5 py-2.5 text-[11px] font-black text-[#e11d48] hover:bg-rose-50">Pengeluaran Saja</button>
                    </div>
                )}
            </div>

            <button 
                onClick={() => handleOpenAdd('EXPENSE')} 
                className="flex items-center gap-2 px-6 py-2.5 bg-[#e11d48] text-white rounded-[0.75rem] font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-200 hover:brightness-110 transition-all active:scale-95"
            >
                <Minus size={16} strokeWidth={4} /> KELUAR
            </button>
            <button 
                onClick={() => handleOpenAdd('INCOME')} 
                className="flex items-center gap-2 px-6 py-2.5 bg-[#059669] text-white rounded-[0.75rem] font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:brightness-110 transition-all active:scale-95"
            >
                <Plus size={16} strokeWidth={4} /> MASUK
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
          <div className="p-5 border bg-emerald-50/50 border-emerald-100 rounded-[1.75rem] text-left">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-2 text-emerald-400">TOTAL MASUK</p>
              <h3 className="text-2xl font-black truncate leading-none text-emerald-700">Rp {summary.totalIncome.toLocaleString()}</h3>
          </div>
          <div className="p-5 border bg-rose-50/50 border-rose-100 rounded-[1.75rem] text-left">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-2 text-rose-400">TOTAL KELUAR</p>
              <h3 className="text-2xl font-black truncate leading-none text-rose-700">Rp {summary.totalExpense.toLocaleString()}</h3>
          </div>
          <div className="p-5 border bg-[#0f172a] border-slate-800 rounded-[1.75rem] text-left text-white">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] mb-2 text-slate-400">SALDO AKHIR</p>
              <h3 className="text-2xl font-black truncate leading-none text-white">Rp {summary.finalBalance.toLocaleString()}</h3>
          </div>
      </div>

      {/* Main Table Content */}
      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50/30 shrink-0 gap-3">
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 items-center overflow-x-auto no-scrollbar">
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'INCOME', label: 'Masuk' },
                  { id: 'EXPENSE', label: 'Keluar' },
                  { id: 'CASH', label: 'Tunai' }
                ].map(tab => (
                    <button 
                        key={tab.id} 
                        onClick={() => setActiveTab(tab.id)} 
                        className={`px-5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {tab.label}
                    </button>
                ))}
                
                <div className="w-[1px] h-4 bg-slate-200 mx-2 shrink-0"></div>
                
                <div className="relative shrink-0">
                    <select 
                        value={activeTab.startsWith('BANK_') || activeTab === 'TRANSFER' ? activeTab : 'NONE'}
                        onChange={(e) => setActiveTab(e.target.value)}
                        className={`pl-4 pr-8 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all outline-none appearance-none cursor-pointer border ${activeTab.startsWith('BANK_') || activeTab === 'TRANSFER' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'bg-transparent text-slate-400 hover:text-slate-600 border-transparent'}`}
                    >
                        <option value="NONE" disabled>Pilih Bank</option>
                        <option value="TRANSFER">Semua Bank</option>
                        {bankAccounts.map(acc => (
                            <option key={acc.id} value={`BANK_${acc.id}`}>{acc.bankName}</option>
                        ))}
                    </select>
                    <ChevronDown size={8} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                </div>
            </div>
            
            <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input type="text" placeholder="Cari keterangan..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-slate-100 transition-all" />
            </div>
          </div>
          
          <div className="overflow-auto flex-1 relative sticky-header custom-scrollbar">
            <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <tr>
                        <th className="px-6 py-4">Tanggal</th>
                        <th className="px-6 py-4">Keterangan / Pos Akun</th>
                        <th className="px-6 py-4 text-center">Sumber/Metode</th>
                        <th className="px-6 py-4 text-right">Jumlah (Rp)</th>
                        <th className="px-6 py-4 text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredTransactions.length > 0 ? (filteredTransactions.map(t => {
                        const bank = t.paymentMethod === 'TRANSFER' ? bankAccounts.find(b => b.id === t.bankAccountId) : null;
                        return (
                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-6 py-4 text-[10px] font-black text-slate-500">{t.date.split('-').reverse().join('/')}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="text-[12px] font-black text-slate-800 leading-tight">{t.description}</span>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider mt-0.5">{t.category}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black border ${t.paymentMethod === 'TRANSFER' ? 'text-blue-600 border-blue-100 bg-blue-50' : 'text-slate-500 border-slate-100 bg-slate-50'}`}>
                                            {t.paymentMethod === 'CASH' ? 'TUNAI' : 'BANK'}
                                        </span>
                                        {bank && <span className="text-[7px] font-black text-blue-400 uppercase truncate max-w-[80px]">{bank.bankName}</span>}
                                    </div>
                                </td>
                                <td className={`px-6 py-4 text-right font-black text-[13px] ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {t.type === 'INCOME' ? '+' : '-'} Rp {t.amount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenEdit(t)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"><Edit size={14} /></button>
                                        <button onClick={() => { if(window.confirm("Hapus data transaksi ini?")) deleteTransaction(t.id)}} className="p-2 text-rose-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-24 text-center">
                                <div className="flex flex-col items-center justify-center opacity-30">
                                    <FileSpreadsheet size={64} className="text-slate-200 mb-4" />
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Data Tidak Ditemukan</p>
                                    <p className="text-[10px] font-bold mt-2">Sesuaikan kriteria filter atau masukkan data baru</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-8 relative animate-in zoom-in duration-200 text-center">
                  <button onClick={() => setShowImportModal(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X size={20}/></button>
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-500 shadow-inner">
                      <FileUp size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Import Excel</h3>
                  <p className="text-[11px] font-bold text-slate-400 mb-8 uppercase tracking-widest leading-relaxed">Impor data transaksi secara massal menggunakan template excel yang tersedia.</p>
                  
                  <div className="space-y-3">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl hover:bg-black active:scale-95 transition-all"
                      >
                          <FileSpreadsheet size={16} /> Pilih File Excel
                      </button>
                      <button 
                        onClick={downloadTemplate}
                        className="w-full py-3 text-blue-500 font-black text-[10px] uppercase tracking-widest hover:underline"
                      >
                          Unduh Template Excel
                      </button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleImportFile} />
              </div>
          </div>
      )}

      {/* Modal Input Form */}
      {showInputModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-[2.5rem] shadow-2xl max-sm w-full overflow-hidden flex flex-col animate-in zoom-in duration-200">
                  {/* Modal Header */}
                  <div className="px-8 pt-8 pb-4 flex justify-between items-center bg-white shrink-0">
                      <h3 className="font-extrabold text-[#1e293b] text-base leading-none">
                        {inputType === 'INCOME' ? 'Input Pemasukan' : 'Input Pengeluaran'}
                      </h3>
                      <button onClick={() => setShowInputModal(false)} className="text-slate-300 hover:text-slate-500 transition-colors p-1">
                          <X size={20} strokeWidth={3} />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSaveTransaction} className="px-8 pb-8 space-y-6 overflow-y-auto custom-scrollbar">
                      {/* TANGGAL */}
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2 ml-1">TANGGAL</label>
                          <div className="relative">
                            <input 
                                type="date" 
                                required 
                                value={formData.date} 
                                onChange={e => setFormData({...formData, date: e.target.value})} 
                                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all appearance-none" 
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                <Calendar size={18} />
                            </div>
                          </div>
                      </div>

                      {/* KETERANGAN */}
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2 ml-1">KETERANGAN</label>
                          <input 
                              type="text"
                              value={formData.description} 
                              onChange={e => setFormData({...formData, description: e.target.value})} 
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all" 
                              placeholder="Tulis rincian..." 
                          />
                      </div>

                      {/* KATEGORI */}
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2 ml-1">KATEGORI</label>
                          <div className="relative">
                            <select 
                                required 
                                value={formData.category} 
                                onChange={e => setFormData({...formData, category: e.target.value})} 
                                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all appearance-none cursor-pointer"
                            >
                                <option value="">-- Pilih Kategori --</option>
                                {settings.transactionCategories.filter(cat => cat.type === inputType).map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                <ChevronDown size={18} strokeWidth={3} />
                            </div>
                          </div>
                      </div>

                      {/* JUMLAH (RP) */}
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2 ml-1">JUMLAH (RP)</label>
                          <input 
                              type="number" 
                              required 
                              value={formData.amount} 
                              onChange={e => setFormData({...formData, amount: e.target.value})} 
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xl text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all" 
                              placeholder="0" 
                          />
                      </div>

                      {/* METODE PEMBAYARAN */}
                      <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2 ml-1">METODE PEMBAYARAN</label>
                          <div className="grid grid-cols-2 gap-3">
                              <button 
                                  type="button" 
                                  onClick={() => setFormData({...formData, paymentMethod: 'CASH'})} 
                                  className={`py-3.5 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${formData.paymentMethod === 'CASH' ? 'bg-[#1e293b] border-[#1e293b] text-white shadow-lg' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}
                              >
                                  TUNAI
                              </button>
                              <button 
                                  type="button" 
                                  onClick={() => setFormData({...formData, paymentMethod: 'TRANSFER'})} 
                                  className={`py-3.5 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${formData.paymentMethod === 'TRANSFER' ? 'bg-[#1e293b] border-[#1e293b] text-white shadow-lg' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}
                              >
                                  TRANSFER
                              </button>
                          </div>
                      </div>

                      {/* Optional Bank Selection if Transfer */}
                      {formData.paymentMethod === 'TRANSFER' && (
                          <div className="animate-in slide-in-from-top-2">
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2 ml-1">REKENING BANK</label>
                              <select 
                                  required 
                                  value={formData.bankAccountId} 
                                  onChange={e => setFormData({...formData, bankAccountId: e.target.value})} 
                                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-700 outline-none"
                              >
                                  <option value="">-- Pilih Rekening --</option>
                                  {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>)}
                              </select>
                          </div>
                      )}

                      {/* SUBMIT BUTTON */}
                      <div className="pt-4">
                          <button 
                              type="submit" 
                              disabled={isSubmitting} 
                              className="w-full py-5 bg-[#1e293b] hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-[0_15px_30px_-5px_rgba(30,41,59,0.3)] transition-all active:scale-[0.97] flex items-center justify-center gap-3"
                          >
                              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                              <span>{editingId ? 'SIMPAN PERUBAHAN' : 'SIMPAN BARU'}</span>
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Transactions;
