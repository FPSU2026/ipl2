
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
  ArrowRight
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
  
  const [activeTab, setActiveTab] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const firstDayOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

  // Filter States: Updated to Range
  const [dateFilter, setDateFilter] = useState({ 
    startDate: firstDayOfMonth,
    endDate: today.toISOString().split('T')[0]
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

  const generatePDF = (exportType: 'ALL' | 'INCOME' | 'EXPENSE') => {
    const doc = new jsPDF();
    const filterDesc = `${dateFilter.startDate} s/d ${dateFilter.endDate}`;
    
    doc.setFontSize(16);
    doc.text("BUKU KAS HARIAN", 14, 15);
    doc.setFontSize(10);
    doc.text(`${settings.location_name} | Rentang: ${filterDesc}`, 14, 22);

    const data = filteredTransactions.filter(t => exportType === 'ALL' || t.type === exportType).map(t => [
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

    doc.save(`Kas_${filterDesc.replace(/-/g, '')}.pdf`);
  };

  // Calculations
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isWithinDate = t.date >= dateFilter.startDate && t.date <= dateFilter.endDate;
      const matchesTab = activeTab === 'ALL' || t.type === activeTab;
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      return isWithinDate && matchesTab && matchesSearch;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, dateFilter, activeTab, searchTerm]);

  const summary = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    
    // Initial balance logic (Cumulative up to the start of current filter)
    const prevTransactions = transactions.filter(t => t.date < dateFilter.startDate);

    const prevInc = prevTransactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const prevExp = prevTransactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const baseBalance = (settings.cash_initial_balance || 0) + prevInc - prevExp;

    return { 
      totalIncome: income, 
      totalExpense: expense, 
      initialBalance: baseBalance,
      finalBalance: baseBalance + income - expense 
    };
  }, [transactions, filteredTransactions, dateFilter, settings.cash_initial_balance]);

  return (
    <div className="space-y-4 pb-0 animate-in fade-in duration-500 h-full flex flex-col">
      {/* Header Container */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0 px-1 py-2">
        <div className="flex flex-col">
            <h2 className="text-2xl font-black text-[#1e293b] tracking-tight leading-none mb-1">Buku Kas Harian</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Pencatatan Pemasukan & Pengeluaran Operasional</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            {/* Range Filter UI */}
            <div className="flex items-center bg-white border border-slate-200 rounded-[0.85rem] p-1.5 shadow-sm">
                <div className="flex items-center gap-2 px-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Dari</span>
                    <input 
                      type="date" 
                      value={dateFilter.startDate} 
                      onChange={(e) => setDateFilter({...dateFilter, startDate: e.target.value})}
                      className="bg-transparent text-[10px] font-black text-slate-700 outline-none cursor-pointer" 
                    />
                </div>
                <div className="w-[1px] h-4 bg-slate-300 mx-2"></div>
                <div className="flex items-center gap-2 px-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sampai</span>
                    <input 
                      type="date" 
                      value={dateFilter.endDate} 
                      onChange={(e) => setDateFilter({...dateFilter, endDate: e.target.value})}
                      className="bg-transparent text-[10px] font-black text-slate-700 outline-none cursor-pointer" 
                    />
                </div>
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
                    <span className="text-[10px] font-black uppercase tracking-widest">Laporan PDF</span>
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

      {/* Summary Section - ONLY 3 CARDS AS REQUESTED */}
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

      {/* Main Table Container */}
      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 bg-white">
          <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/30 shrink-0">
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                {['ALL', 'INCOME', 'EXPENSE'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}>{tab === 'ALL' ? 'Semua' : tab === 'INCOME' ? 'Masuk' : 'Keluar'}</button>
                ))}
            </div>
            <div className="relative w-56">
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
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Tidak ada data transaksi</p>
                                    <p className="text-[10px] font-bold mt-2">Pilih rentang tanggal lain atau masukkan data baru</p>
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
                  <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Import Transaksi</h3>
                  <p className="text-[11px] font-bold text-slate-400 mb-8 uppercase tracking-widest leading-relaxed">Pilih file Excel yang sesuai dengan template untuk mengimpor data massal.</p>
                  
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

      {/* Input Form Modal */}
      {showInputModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-[2.5rem] shadow-2xl max-md w-full overflow-hidden flex flex-col animate-in zoom-in duration-200">
                  <div className={`p-6 flex justify-between items-center text-white shrink-0 ${inputType === 'INCOME' ? 'bg-[#059669]' : 'bg-[#e11d48]'}`}>
                      <div>
                          <h3 className="font-black text-lg uppercase tracking-tight">{editingId ? 'Ubah Transaksi' : `Input ${inputType === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}`}</h3>
                          <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mt-1">Manajemen Buku Kas Harian</p>
                      </div>
                      <button onClick={() => setShowInputModal(false)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X size={20}/></button>
                  </div>
                  
                  <form onSubmit={handleSaveTransaction} className="p-8 space-y-5 overflow-y-auto custom-scrollbar max-h-[80vh]">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Tanggal</label>
                              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all" />
                          </div>
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">
                                Metode Pembayaran
                              </label>
                              <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value as any})} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-700 outline-none focus:bg-white transition-all cursor-pointer">
                                  <option value="CASH">Tunai (Cash)</option>
                                  <option value="TRANSFER">Transfer Bank</option>
                              </select>
                          </div>
                      </div>

                      {formData.paymentMethod === 'TRANSFER' && (
                          <div className="animate-in slide-in-from-top-2">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Pilih Rekening Bank</label>
                              <select required={formData.paymentMethod === 'TRANSFER'} value={formData.bankAccountId} onChange={e => setFormData({...formData, bankAccountId: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-700 outline-none focus:bg-white transition-all cursor-pointer">
                                  <option value="">-- Pilih Rekening --</option>
                                  {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} ({acc.accountNumber})</option>)}
                              </select>
                          </div>
                      )}

                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Pos Akun / Kategori</label>
                          <select required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-xl font-bold text-xs text-slate-700 outline-none focus:bg-white transition-all cursor-pointer">
                              <option value="">-- Pilih Kategori --</option>
                              {settings.transactionCategories.filter(cat => cat.type === inputType).map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                          </select>
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Jumlah Nominal (Rp)</label>
                          <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-3xl text-slate-800 outline-none focus:bg-white focus:border-slate-300 transition-all" placeholder="0" />
                      </div>

                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Deskripsi / Keterangan</label>
                          <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all resize-none" placeholder="Masukkan rincian tambahan..." />
                      </div>

                      <button type="submit" disabled={isSubmitting} className={`w-full py-5 rounded-[1.5rem] font-black text-[13px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-white ${inputType === 'INCOME' ? 'bg-[#059669] hover:bg-[#047857]' : 'bg-[#e11d48] hover:bg-[#be123c]'}`}>
                          {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                          <span>{editingId ? 'Simpan Perubahan' : 'Proses Transaksi'}</span>
                      </button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default Transactions;
