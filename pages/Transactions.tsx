
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
  const { transactions, deleteTransaction, addTransaction, updateTransaction, settings, addNotification, bankAccounts, bankMutations, currentUser } = useApp();
  
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
  const [editingId, setEditingId] = useState<string | null>(null); // State for Editing
  const [inputData, setInputData] = useState({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      category: '',
      description: '',
      paymentMethod: 'CASH',
      bankAccountId: ''
  });

  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailType, setDetailType] = useState<'INITIAL' | 'INCOME' | 'EXPENSE'>('INITIAL');

  // Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- CALCULATION LOGIC ---

  // 1. Find Existing Saldo Awal for Jan 2026 (Cash Only)
  const jan2026CashTx = useMemo(() => {
      return transactions.find(t => 
          new Date(t.date).getFullYear() === 2026 && 
          new Date(t.date).getMonth() === 0 && // Jan is 0
          t.category === 'Saldo Awal'
      );
  }, [transactions]);

  // 2. Helper: Calculate Cash Base from Jan 2026
  const systemStartCash = useMemo(() => {
      return jan2026CashTx ? jan2026CashTx.amount : 0;
  }, [jan2026CashTx]);

  // 3. Helper: Calculate Bank Start Balance via Forward Winding from Live Ground Truth
  const getBankStartBalance = (accountId: string, currentBalance: number) => {
      const startOfPeriod = new Date(dateFilter.year, dateFilter.month - 1, 1);
      
      // We rewind from current live state to target date
      const futureTx = transactions.filter(t => 
          t.bankAccountId === accountId && 
          new Date(t.date) >= startOfPeriod &&
          t.paymentMethod === 'TRANSFER' &&
          t.category !== 'Saldo Awal'
      );
      const txInc = futureTx.filter(t => t.type === 'INCOME').reduce((s,t) => s + t.amount, 0);
      const txExp = futureTx.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);

      const futureMut = bankMutations.filter(m => 
          m.accountId === accountId &&
          new Date(m.date) >= startOfPeriod
      );
      const mutDebit = futureMut.filter(m => m.type === 'DEBIT').reduce((s,m) => s + m.amount, 0);
      const mutCredit = futureMut.filter(m => m.type === 'KREDIT').reduce((s,m) => s + m.amount, 0);

      return currentBalance - (txInc + mutDebit) + (txExp + mutCredit);
  };

  // 4. Calculate Financial Summary (IMPROVED: Forward winding for Cash, Rewind for Bank)
  const summary = useMemo(() => {
      const startOfPeriod = new Date(dateFilter.year, dateFilter.month - 1, 1);
      const systemStartDate = new Date(2026, 0, 1);

      // FOR CASH: Forward wind from Jan 2026 base to the start of current filter period
      const prevCashTx = transactions.filter(t => 
          new Date(t.date) >= systemStartDate && 
          new Date(t.date) < startOfPeriod &&
          t.paymentMethod === 'CASH' && 
          t.category !== 'Saldo Awal'
      );
      const pCashInc = prevCashTx.filter(t => t.type === 'INCOME').reduce((s,t) => s + t.amount, 0);
      const pCashExp = prevCashTx.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + t.amount, 0);
      const startCash = systemStartCash + pCashInc - pCashExp;

      // FOR BANK: Still rewind from live balances as they represent current ground truth from bank accounts
      let startBankTotal = 0;
      bankAccounts.forEach(acc => {
          startBankTotal += getBankStartBalance(acc.id, acc.balance);
      });

      // Sum of both gives the Beginning Balance for the selected month
      const initialBalance = Math.max(0, startCash + startBankTotal);

      // Current Month Activity
      const currentMonthTx = transactions.filter(t => {
          const d = new Date(t.date);
          return d.getMonth() + 1 === dateFilter.month && 
                 d.getFullYear() === dateFilter.year && 
                 t.category !== 'Saldo Awal';
      });

      const totalIncome = currentMonthTx.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = currentMonthTx.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
      
      const finalBalance = initialBalance + totalIncome - totalExpense;

      return { initialBalance, totalIncome, totalExpense, finalBalance, startCash, startBankTotal };
  }, [transactions, dateFilter, systemStartCash, bankAccounts, bankMutations]);

  // 5. Filter Transactions
  const currentPeriodTransactions = useMemo(() => {
      return transactions.filter(t => {
          const d = new Date(t.date);
          const matchesPeriod = d.getMonth() + 1 === dateFilter.month && d.getFullYear() === dateFilter.year;
          const matchesTab = activeTab === 'ALL' || t.type === activeTab;
          const searchLower = searchTerm.toLowerCase();
          const matchesSearch = t.description.toLowerCase().includes(searchLower) || t.category.toLowerCase().includes(searchLower);
          
          return matchesPeriod && matchesTab && matchesSearch && t.category !== 'Saldo Awal';
      }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 
  }, [transactions, activeTab, dateFilter, searchTerm]);

  // Detail Data Preparation
  const detailData = useMemo(() => {
      if (detailType === 'INITIAL') {
          return {
              title: 'Rincian Saldo Awal',
              items: [
                  { label: 'Saldo Tunai (Kas)', amount: summary.startCash, isHeader: true, isSub: false },
                  { label: 'Saldo Di Bank (Total)', amount: summary.startBankTotal, isHeader: true, isSub: false },
                  ...bankAccounts.map(acc => ({ 
                      label: `${acc.bankName} (${acc.accountNumber})`, 
                      amount: getBankStartBalance(acc.id, acc.balance), 
                      isSub: true, 
                      isHeader: false 
                  }))
              ],
              total: summary.initialBalance
          };
      } 
      
      const type = detailType;
      const relevantTx = currentPeriodTransactions.filter(t => t.type === type);
      
      const grouped: Record<string, number> = {};
      relevantTx.forEach(t => {
          grouped[t.category] = (grouped[t.category] || 0) + t.amount;
      });

      const items = Object.entries(grouped).map(([label, amount]) => ({ label, amount, isHeader: false, isSub: false }));
      const total = items.reduce((acc, curr) => acc + curr.amount, 0);

      return {
          title: type === 'INCOME' ? 'Rincian Pemasukan' : 'Rincian Pengeluaran',
          items: items.sort((a,b) => b.amount - a.amount),
          total
      };

  }, [detailType, summary, bankAccounts, currentPeriodTransactions]);

  // --- HANDLERS ---
  const handleOpenInput = (type: 'INCOME' | 'EXPENSE') => {
      setEditingId(null);
      setInputType(type);
      setInputData({
          date: new Date().toISOString().split('T')[0],
          amount: '',
          category: '',
          description: '',
          paymentMethod: 'CASH',
          bankAccountId: ''
      });
      setShowInputModal(true);
  };

  const handleSaldoAwal = () => {
      setInputType('INCOME');
      if (jan2026CashTx) {
          setEditingId(jan2026CashTx.id);
          setInputData({
              date: jan2026CashTx.date,
              amount: jan2026CashTx.amount.toString(),
              category: 'Saldo Awal',
              description: jan2026CashTx.description,
              paymentMethod: 'CASH',
              bankAccountId: ''
          });
      } else {
          setEditingId(null);
          setInputData({
              date: '2026-01-01',
              amount: '',
              category: 'Saldo Awal',
              description: 'Saldo Awal Kas Tunai',
              paymentMethod: 'CASH',
              bankAccountId: ''
          });
      }
      setShowInputModal(true);
  };

  const handleOpenDetail = (type: 'INITIAL' | 'INCOME' | 'EXPENSE') => {
      setDetailType(type);
      setShowDetailModal(true);
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputData.amount || !inputData.description || !inputData.category) {
          addNotification("Mohon lengkapi semua field", "warning");
          return;
      }

      const txPayload = {
          date: inputData.date,
          type: inputType,
          category: inputData.category,
          amount: parseInt(inputData.amount),
          description: inputData.description,
          paymentMethod: inputData.paymentMethod as any,
          bankAccountId: inputData.paymentMethod === 'TRANSFER' ? inputData.bankAccountId : undefined
      };

      if (editingId) {
          await updateTransaction({ id: editingId, ...txPayload });
          addNotification("Transaksi berhasil diperbarui", "success");
      } else {
          await addTransaction({ id: `manual-${Date.now()}`, ...txPayload });
          addNotification("Transaksi berhasil disimpan", "success");
      }

      setShowInputModal(false);
      setEditingId(null);
  };

  const handleDelete = async (id: string) => {
      if (window.confirm("Yakin ingin menghapus transaksi ini?")) {
          await deleteTransaction(id);
      }
  };

  const generatePDF = (exportType: 'ALL' | 'INCOME' | 'EXPENSE') => {
    const doc = new jsPDF();
    const monthName = MONTHS[dateFilter.month - 1];
    
    const dataToExport = transactions.filter(t => {
        const d = new Date(t.date);
        const matchesPeriod = d.getMonth() + 1 === dateFilter.month && d.getFullYear() === dateFilter.year;
        const matchesType = exportType === 'ALL' || t.type === exportType;
        return matchesPeriod && matchesType && t.category !== 'Saldo Awal';
    }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()); 

    const titlePrefix = exportType === 'ALL' ? 'Buku Kas Harian' : exportType === 'INCOME' ? 'Laporan Pemasukan' : 'Laporan Pengeluaran';

    doc.setFontSize(14);
    doc.text(`${titlePrefix} - ${monthName} ${dateFilter.year}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`${settings.location_name}`, 14, 20);

    const tableData = dataToExport.map(t => [
        new Date(t.date).toLocaleDateString('id-ID'),
        t.category,
        t.description,
        t.paymentMethod,
        t.type === 'INCOME' ? `+ Rp ${t.amount.toLocaleString()}` : `- Rp ${t.amount.toLocaleString()}`
    ]);

    autoTable(doc, {
        head: [['Tanggal', 'Kategori', 'Keterangan', 'Metode', 'Jumlah']],
        body: tableData,
        startY: 25,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 41, 59] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    if (exportType === 'ALL') {
        doc.text(`Total Masuk: Rp ${summary.totalIncome.toLocaleString()}`, 14, finalY);
        doc.text(`Total Keluar: Rp ${summary.totalExpense.toLocaleString()}`, 14, finalY + 5);
        doc.text(`Saldo Akhir: Rp ${summary.finalBalance.toLocaleString()}`, 14, finalY + 10);
    } else if (exportType === 'INCOME') {
        const totalInc = dataToExport.reduce((sum, t) => sum + t.amount, 0);
        doc.text(`Total Pemasukan: Rp ${totalInc.toLocaleString()}`, 14, finalY);
    } else {
        const totalExp = dataToExport.reduce((sum, t) => sum + t.amount, 0);
        doc.text(`Total Pengeluaran: Rp ${totalExp.toLocaleString()}`, 14, finalY);
    }

    doc.save(`${titlePrefix.replace(/\s/g, '_')}_${monthName}_${dateFilter.year}.pdf`);
    setShowPdfOptions(false);
  };

  const downloadTemplate = () => {
    const data = [
        { "TANGGAL": "2025-01-01", "TIPE": "INCOME", "KATEGORI": "Iuran Warga", "JUMLAH": 150000, "KETERANGAN": "Contoh Pemasukan (INCOME)", "METODE": "CASH" },
        { "TANGGAL": "2025-01-02", "TIPE": "EXPENSE", "KATEGORI": "Listrik", "JUMLAH": 50000, "KETERANGAN": "Contoh Pengeluaran (EXPENSE)", "METODE": "CASH" },
        { "TANGGAL": "2025-01-03", "TIPE": "PEMASUKAN", "KATEGORI": "Sumbangan", "JUMLAH": 500000, "KETERANGAN": "Bisa pakai bahasa Indonesia (PEMASUKAN)", "METODE": "TRANSFER" },
        { "TANGGAL": "2025-01-04", "TIPE": "PENGELUARAN", "KATEGORI": "Perbaikan", "JUMLAH": 200000, "KETERANGAN": "Bisa pakai bahasa Indonesia (PENGELUARAN)", "METODE": "TUNAI" }
    ];
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_transaksi_harian.xlsx");
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
            
            let count = 0;
            for (const row of jsonData) {
                if (row.JUMLAH && row.TIPE) {
                    const amount = parseInt(String(row.JUMLAH).replace(/\D/g,''));
                    
                    let dateStr = new Date().toISOString();
                    if (row.TANGGAL) {
                        if (typeof row.TANGGAL === 'number') {
                             dateStr = new Date(Math.round((row.TANGGAL - 25569)*86400*1000)).toISOString();
                        } else {
                             dateStr = new Date(row.TANGGAL).toISOString();
                        }
                    }

                    // Flexible Type Parsing
                    const typeRaw = String(row.TIPE).toUpperCase().trim();
                    const type = (typeRaw === 'INCOME' || typeRaw === 'PEMASUKAN' || typeRaw === 'MASUK') ? 'INCOME' : 'EXPENSE';

                    // Flexible Method Parsing
                    const methodRaw = String(row.METODE || 'CASH').toUpperCase().trim();
                    const paymentMethod = (methodRaw === 'TRANSFER') ? 'TRANSFER' : 'CASH';

                    await addTransaction({
                        id: `imp-${Date.now()}-${Math.random()}`,
                        date: dateStr.split('T')[0],
                        type: type,
                        category: row.KATEGORI || 'Umum',
                        amount: amount,
                        description: row.KETERANGAN || '-',
                        paymentMethod: paymentMethod,
                        bankAccountId: '' 
                    });
                    count++;
                }
            }
            addNotification(`${count} Transaksi berhasil diimpor`, "success");
            setShowImportModal(false);
        } catch (error) {
            addNotification("Gagal import file", "error");
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Buku Kas Harian</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">PENCATATAN PEMASUKAN & PENGELUARAN OPERASIONAL</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            {/* Filter */}
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
                    <option value={2026}>2026</option>
                </select>
            </div>

            {/* Tombol Saldo Awal (Jan 2026 Only) */}
            {dateFilter.month === 1 && dateFilter.year === 2026 && (
                (!jan2026CashTx || currentUser?.id === '0') && (
                    <button 
                        onClick={handleSaldoAwal}
                        className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        {jan2026CashTx ? <Edit size={14} /> : <Wallet size={14} />}
                        {jan2026CashTx ? 'Koreksi Saldo Awal' : 'Input Saldo Awal'}
                    </button>
                )
            )}

            {/* Export/Import Buttons */}
            <div className="flex items-center gap-2 relative">
                <button 
                    onClick={() => setShowImportModal(true)}
                    className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                    title="Import Excel"
                >
                    <Upload size={16} />
                </button>
                
                {/* PDF Dropdown */}
                <div className="relative">
                    <button 
                        onClick={() => setShowPdfOptions(!showPdfOptions)}
                        className="px-4 py-3 bg-red-50 border border-red-100 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all flex items-center gap-2"
                    >
                        <Printer size={14} /> PDF <ChevronDown size={10} />
                    </button>
                    {showPdfOptions && (
                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                            <button onClick={() => generatePDF('ALL')} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-xs font-bold text-slate-700">Semua Data</button>
                            <button onClick={() => generatePDF('INCOME')} className="w-full text-left px-4 py-3 hover:bg-emerald-50 text-xs font-bold text-emerald-600">Pemasukan Saja</button>
                            <button onClick={() => generatePDF('EXPENSE')} className="w-full text-left px-4 py-3 hover:bg-rose-50 text-xs font-bold text-rose-600">Pengeluaran Saja</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <button 
                onClick={() => handleOpenInput('EXPENSE')}
                className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-600/20 active:scale-95 transition-all flex items-center gap-2"
            >
                <Minus size={14} strokeWidth={4} /> KELUAR
            </button>
            <button 
                onClick={() => handleOpenInput('INCOME')}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-2"
            >
                <Plus size={14} strokeWidth={4} /> MASUK
            </button>
        </div>
      </div>

      {/* SUMMARY CARDS - CLICKABLE FOR DETAILS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Saldo Awal */}
          <button 
            onClick={() => handleOpenDetail('INITIAL')}
            className="p-6 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] flex flex-col justify-center relative overflow-hidden text-left hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group"
          >
              <div className="absolute top-4 right-4 opacity-10 text-indigo-600 group-hover:opacity-20 transition-opacity"><Wallet size={40} /></div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">SALDO AWAL</p>
              <h3 className="text-2xl font-black text-indigo-700 truncate">Rp {summary.initialBalance.toLocaleString('id-ID')}</h3>
              <p className="text-[9px] font-bold text-indigo-300 mt-1 flex items-center gap-1">
                  Per 1 {MONTHS[dateFilter.month-1]} <PieChart size={10} />
              </p>
          </button>

          {/* Total Masuk */}
          <button 
            onClick={() => handleOpenDetail('INCOME')}
            className="p-6 bg-emerald-50/50 border border-emerald-100 rounded-[2rem] flex flex-col justify-center relative overflow-hidden text-left hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group"
          >
              <div className="absolute top-4 right-4 opacity-10 text-emerald-600 group-hover:opacity-20 transition-opacity"><Upload size={40} /></div>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">TOTAL MASUK</p>
              <h3 className="text-2xl font-black text-emerald-600 truncate">+ Rp {summary.totalIncome.toLocaleString('id-ID')}</h3>
              <p className="text-[9px] font-bold text-emerald-300 mt-1 flex items-center gap-1">
                  Lihat Rincian <PieChart size={10} />
              </p>
          </button>

          {/* Total Keluar */}
          <button 
            onClick={() => handleOpenDetail('EXPENSE')}
            className="p-6 bg-rose-50/50 border border-rose-100 rounded-[2rem] flex flex-col justify-center relative overflow-hidden text-left hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group"
          >
              <div className="absolute top-4 right-4 opacity-10 text-rose-600 group-hover:opacity-20 transition-opacity"><Download size={40} /></div>
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">TOTAL KELUAR</p>
              <h3 className="text-2xl font-black text-rose-600 truncate">- Rp {summary.totalExpense.toLocaleString('id-ID')}</h3>
              <p className="text-[9px] font-bold text-rose-300 mt-1 flex items-center gap-1">
                  Lihat Rincian <PieChart size={10} />
              </p>
          </button>

          {/* Saldo Akhir - Static */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-[2rem] flex flex-col justify-center relative overflow-hidden text-white shadow-xl shadow-slate-900/10">
              <div className="absolute top-0 right-0 p-6 opacity-10"><Wallet size={60} /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2"><Calendar size={12} /> SALDO AKHIR</p>
              <h3 className="text-3xl font-black tracking-tight truncate">Rp {summary.finalBalance.toLocaleString('id-ID')}</h3>
              <p className="text-[9px] font-bold text-slate-500 mt-1">Termasuk Bank</p>
          </div>
      </div>

      {/* TABLE SECTION */}
      <div className="card bg-white border border-slate-100 shadow-sm rounded-[2rem] overflow-hidden min-h-[500px] flex flex-col">
          {/* Table Toolbar */}
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
              {/* Tabs */}
              <div className="flex bg-slate-50 p-1.5 rounded-full border border-slate-100">
                  {['ALL', 'INCOME', 'EXPENSE'].map(tab => (
                      <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                      >
                          {tab === 'ALL' ? 'Semua' : tab === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                      </button>
                  ))}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input 
                      type="text" 
                      placeholder="Cari..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-full text-xs font-bold outline-none focus:border-slate-800 transition-all"
                  />
              </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                      <tr>
                          <th className="px-8 py-5">Tanggal</th>
                          <th className="px-8 py-5">Keterangan</th>
                          <th className="px-8 py-5">Kategori</th>
                          <th className="px-8 py-5 text-center">Metode</th>
                          <th className="px-8 py-5 text-right">Jumlah</th>
                          <th className="px-8 py-5 text-center">Aksi</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {currentPeriodTransactions.length > 0 ? (
                          currentPeriodTransactions.map(t => (
                              <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                                  <td className="px-8 py-5 text-xs font-bold text-slate-500">
                                      {new Date(t.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year: 'numeric'})}
                                  </td>
                                  <td className="px-8 py-5">
                                      <p className="text-sm font-bold text-slate-700">{t.description}</p>
                                  </td>
                                  <td className="px-8 py-5">
                                      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-wider">
                                          {t.category}
                                      </span>
                                  </td>
                                  <td className="px-8 py-5 text-center">
                                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${t.paymentMethod === 'TRANSFER' ? 'text-blue-500 bg-blue-50' : 'text-slate-500 bg-slate-100'}`}>
                                          {t.paymentMethod}
                                      </span>
                                  </td>
                                  <td className="px-8 py-5 text-right">
                                      <span className={`text-sm font-black ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {t.type === 'INCOME' ? '+' : '-'} Rp {t.amount.toLocaleString('id-ID')}
                                      </span>
                                  </td>
                                  <td className="px-8 py-5 text-center">
                                      {/* Only allow deleting manual transactions (not synced ones like Bill Payments) unless Super Admin */}
                                      {(t.bill_id === null && t.category !== 'Saldo Awal') || currentUser?.id === '0' ? (
                                          <button 
                                            onClick={() => handleDelete(t.id)}
                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                          >
                                              <Trash2 size={16} />
                                          </button>
                                      ) : null}
                                  </td>
                              </tr>
                          ))
                      ) : (
                          <tr>
                              <td colSpan={6} className="px-8 py-32 text-center">
                                  <div className="flex flex-col items-center justify-center opacity-30">
                                      <FileText size={48} className="text-slate-400 mb-4" />
                                      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">
                                          Tidak ada transaksi ditemukan
                                      </p>
                                  </div>
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {/* INPUT MODAL */}
      {showInputModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
                  <div className={`p-6 flex justify-between items-center ${inputType === 'INCOME' ? 'bg-emerald-600' : 'bg-rose-600'} text-white`}>
                      <div>
                          <h3 className="font-black text-lg">{editingId ? 'Edit Transaksi' : `Input ${inputType === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}`}</h3>
                          <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">{editingId ? 'Perbarui Data' : 'Tambah Transaksi Baru'}</p>
                      </div>
                      <button onClick={() => setShowInputModal(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all"><X size={18} /></button>
                  </div>
                  
                  <form onSubmit={handleInputSubmit} className="p-8 space-y-5">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tanggal</label>
                          <input 
                              type="date" 
                              value={inputData.date}
                              onChange={(e) => setInputData({...inputData, date: e.target.value})}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm outline-none focus:border-slate-800"
                          />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Kategori</label>
                          <select 
                              value={inputData.category}
                              onChange={(e) => setInputData({...inputData, category: e.target.value})}
                              disabled={inputData.category === 'Saldo Awal'} // Disable changing category if editing Saldo Awal
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm outline-none focus:border-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                              {inputData.category === 'Saldo Awal' ? (
                                  <option value="Saldo Awal">Saldo Awal</option>
                              ) : (
                                  <>
                                    <option value="">-- Pilih Kategori --</option>
                                    {settings.transactionCategories
                                        .filter(c => c.type === inputType)
                                        .map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                                    }
                                    <option value="Lainnya">Lainnya</option>
                                  </>
                              )}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Keterangan</label>
                          <input 
                              type="text" 
                              placeholder="Contoh: Beli Alat Tulis / Sumbangan"
                              value={inputData.description}
                              onChange={(e) => setInputData({...inputData, description: e.target.value})}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm outline-none focus:border-slate-800"
                          />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Metode</label>
                          {inputData.category === 'Saldo Awal' ? (
                              <div className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-500 text-sm">
                                  Tunai (CASH)
                              </div>
                          ) : (
                              <div className="flex bg-slate-100 p-1 rounded-xl">
                                  <button type="button" onClick={() => setInputData({...inputData, paymentMethod: 'CASH'})} disabled={inputData.category === 'Saldo Awal'} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${inputData.paymentMethod === 'CASH' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Tunai (Cash)</button>
                                  <button type="button" onClick={() => setInputData({...inputData, paymentMethod: 'TRANSFER'})} disabled={inputData.category === 'Saldo Awal'} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${inputData.paymentMethod === 'TRANSFER' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>Transfer</button>
                              </div>
                          )}
                      </div>
                      
                      {inputData.paymentMethod === 'TRANSFER' && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Akun Bank</label>
                              <select 
                                  value={inputData.bankAccountId}
                                  onChange={(e) => setInputData({...inputData, bankAccountId: e.target.value})}
                                  className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl font-bold text-blue-700 text-sm outline-none"
                              >
                                  <option value="">-- Pilih Rekening --</option>
                                  {bankAccounts.filter(acc => acc.isActive).map(acc => (
                                      <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>
                                  ))}
                              </select>
                          </div>
                      )}

                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Jumlah (Rp)</label>
                          <input 
                              type="number" 
                              value={inputData.amount}
                              onChange={(e) => setInputData({...inputData, amount: e.target.value})}
                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl text-slate-800 outline-none focus:border-slate-800"
                              placeholder="0"
                          />
                      </div>

                      <button type="submit" className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl active:scale-95 transition-all ${inputType === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'}`}>
                          {editingId ? 'Simpan Perubahan' : 'Simpan Transaksi'}
                      </button>
                  </form>
              </div>
          </div>
      )}

      {/* DETAIL SUMMARY MODAL */}
      {showDetailModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                  <div className={`p-6 flex justify-between items-center ${detailType === 'INITIAL' ? 'bg-indigo-600' : detailType === 'INCOME' ? 'bg-emerald-600' : 'bg-rose-600'} text-white shrink-0`}>
                      <div>
                          <h3 className="font-black text-lg">{detailData.title}</h3>
                          <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">{MONTHS[dateFilter.month-1]} {dateFilter.year}</p>
                      </div>
                      <button onClick={() => setShowDetailModal(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-all"><X size={18} /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      {detailData.items.length > 0 ? (
                          <div className="space-y-4">
                              {detailData.items.map((item, idx) => (
                                  <div key={idx} className={`flex justify-between items-center ${item.isHeader ? 'border-b border-slate-200 pb-2 mb-2 font-black text-slate-800' : item.isSub ? 'pl-4 text-slate-500 text-xs font-bold' : 'text-sm font-bold text-slate-600'}`}>
                                      <span>{item.label}</span>
                                      <span className={`${item.isHeader ? 'text-base' : ''} ${detailType === 'INCOME' && !item.isHeader ? 'text-emerald-600' : detailType === 'EXPENSE' && !item.isHeader ? 'text-rose-600' : ''}`}>
                                          Rp {item.amount.toLocaleString('id-ID')}
                                      </span>
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="text-center text-slate-400 py-10 text-xs italic">
                              Belum ada data
                          </div>
                      )}
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
                      <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Keseluruhan</span>
                          <span className={`text-xl font-black ${detailType === 'INITIAL' ? 'text-indigo-600' : detailType === 'INCOME' ? 'text-emerald-600' : detailType === 'EXPENSE' ? 'text-rose-600' : ''}`}>
                              Rp {detailData.total.toLocaleString('id-ID')}
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
                  <h3 className="font-black text-lg mb-2">Import Data Excel</h3>
                  <p className="text-xs text-slate-500 mb-6">Gunakan template yang sesuai untuk import massal.</p>
                  
                  <input 
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleImportFile}
                  />

                  <div className="space-y-3">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                          <Upload size={16} /> Pilih File Excel
                      </button>
                      <button 
                        onClick={downloadTemplate}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-2"
                      >
                          <FileSpreadsheet size={16} /> Download Template
                      </button>
                      <button onClick={() => setShowImportModal(false)} className="w-full py-3 text-slate-400 font-bold text-xs">Batal</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Transactions;
