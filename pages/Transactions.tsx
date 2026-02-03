
import React, { useState, useMemo, useRef, useEffect } from 'react';
// Added ArrowRight to lucide-react imports to fix compilation error on line 486
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowRight,
  Filter, 
  Download, 
  X, 
  Save, 
  CreditCard, 
  Banknote, 
  Calendar, 
  Search, 
  Upload, 
  FileText, 
  Wallet, 
  History, 
  ArchiveRestore, 
  Edit, 
  Building2, 
  PieChart, 
  List, 
  ExternalLink, 
  Lock, 
  ChevronRight, 
  Loader2, 
  Trash2, 
  CalendarRange, 
  Printer,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Transaction } from '../types';
import { MONTHS } from '../constants';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Transactions: React.FC = () => {
  const { transactions, addTransaction, updateTransaction, deleteTransaction, bankAccounts, settings, addNotification, currentUser } = useApp();
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const today = new Date().toISOString().split('T')[0];

  // Filter States
  const [filterMode, setFilterMode] = useState<'DAILY' | 'MONTHLY' | 'RANGE'>('MONTHLY');
  const [selectedDay, setSelectedDay] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  // Date Range States
  const [dateRange, setDateRange] = useState({
      start: new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0],
      end: today
  });

  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showInitialBalanceModal, setShowInitialBalanceModal] = useState(false); 
  const [showBalanceDetailModal, setShowBalanceDetailModal] = useState(false);
  const [showSummaryDetailModal, setShowSummaryDetailModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [summaryDetailType, setSummaryDetailType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  const importFileRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<Transaction>>({
    date: today,
    description: '',
    type: 'EXPENSE',
    category: '',
    amount: 0,
    paymentMethod: 'CASH',
    bankAccountId: ''
  });

  const [initialBalanceData, setInitialBalanceData] = useState({ cashAmount: 0 });
  const [editCount, setEditCount] = useState<number>(() => parseInt(localStorage.getItem('saldo_awal_edit_count') || '0'));
  const isSuperAdmin = currentUser?.id === '0';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModal(false); setShowImportModal(false); setShowInitialBalanceModal(false); 
        setShowBalanceDetailModal(false); setShowSummaryDetailModal(false); setShowExportMenu(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        window.removeEventListener('keydown', handleEsc);
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const jan2026CashTx = useMemo(() => {
      return transactions.find(t => {
          const d = new Date(t.date);
          return d.getFullYear() === 2026 && d.getMonth() === 0 && t.category === 'Saldo Awal' && t.paymentMethod === 'CASH';
      });
  }, [transactions]);

  // --- REFINED DYNAMIC BEGINNING BALANCE LOGIC ---
  const { beginningBalance, balanceBreakdown } = useMemo(() => {
    const initialCashBase = jan2026CashTx ? jan2026CashTx.amount : 0;
    const currentBankTotal = bankAccounts.reduce((acc, bank) => acc + bank.balance, 0);

    const allBankAffectingTx = transactions.filter(t => 
        t.paymentMethod === 'TRANSFER' && t.bankAccountId && t.category !== 'Saldo Awal'
    );

    const totalBankIncomeEver = allBankAffectingTx.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const totalBankExpenseEver = allBankAffectingTx.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    
    const systemStartBankTotal = currentBankTotal - totalBankIncomeEver + totalBankExpenseEver;
    const systemStartTotal = initialCashBase + systemStartBankTotal;

    let cutoffDateStr: string;
    if (filterMode === 'DAILY') {
        cutoffDateStr = selectedDay;
    } else if (filterMode === 'MONTHLY') {
        cutoffDateStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
    } else {
        cutoffDateStr = dateRange.start;
    }

    const txBeforeCutoff = transactions.filter(t => 
        t.date >= '2026-01-01' && t.date < cutoffDateStr && t.category !== 'Saldo Awal'
    );

    const incomeBefore = txBeforeCutoff.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const expenseBefore = txBeforeCutoff.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    
    const calculatedBeginningTotal = systemStartTotal + incomeBefore - expenseBefore;

    const cashTxBeforeCutoff = txBeforeCutoff.filter(t => t.paymentMethod === 'CASH');
    const cashIncBefore = cashTxBeforeCutoff.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const cashExpBefore = cashTxBeforeCutoff.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    const calculatedCashAtCutoff = initialCashBase + cashIncBefore - cashExpBefore;

    const bankDetailsAtCutoff: Record<string, number> = {};
    bankAccounts.forEach(acc => {
        const accTxEver = allBankAffectingTx.filter(t => t.bankAccountId === acc.id);
        const accIncEver = accTxEver.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
        const accExpEver = accTxEver.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
        const accStartBalance = acc.balance - accIncEver + accExpEver;

        const accTxBefore = txBeforeCutoff.filter(t => t.bankAccountId === acc.id && t.paymentMethod === 'TRANSFER');
        const accIncBefore = accTxBefore.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
        const accExpBefore = accTxBefore.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

        bankDetailsAtCutoff[acc.id] = accStartBalance + accIncBefore - accExpBefore;
    });

    return { 
        beginningBalance: calculatedBeginningTotal, 
        balanceBreakdown: { cash: calculatedCashAtCutoff, bankDetails: bankDetailsAtCutoff }
    };
  }, [transactions, filterMode, selectedDay, selectedMonth, selectedYear, dateRange.start, jan2026CashTx, bankAccounts]);

  const periodTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.category === 'Saldo Awal') return false;
      
      if (filterMode === 'DAILY') {
          return t.date === selectedDay;
      } else if (filterMode === 'MONTHLY') {
          const date = new Date(t.date);
          return (date.getMonth() + 1) === selectedMonth && date.getFullYear() === selectedYear;
      } else {
          return t.date >= dateRange.start && t.date <= dateRange.end;
      }
    });
  }, [transactions, filterMode, selectedDay, selectedMonth, selectedYear, dateRange]);

  const totalIncome = periodTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = periodTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
  const endingBalance = beginningBalance + totalIncome - totalExpense;

  const displayedTransactions = useMemo(() => {
    return periodTransactions.filter(t => {
      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || t.amount.toString().includes(searchQuery);
      return matchesType && matchesSearch;
    });
  }, [periodTransactions, typeFilter, searchQuery]);

  // --- PDF EXPORT LOGIC WITH SCOPE ---
  const handleExportPDF = (scope: 'ALL' | 'INCOME' | 'EXPENSE') => {
    const doc = new jsPDF();
    const periodText = filterMode === 'DAILY' 
        ? new Date(selectedDay).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : filterMode === 'MONTHLY' 
            ? `${MONTHS[selectedMonth-1]} ${selectedYear}`
            : `${new Date(dateRange.start).toLocaleDateString('id-ID')} s/d ${new Date(dateRange.end).toLocaleDateString('id-ID')}`;
    
    let reportTitle = "REKAP TRANSAKSI KAS/BANK";
    let filterType = "Semua Transaksi";
    if (scope === 'INCOME') { reportTitle = "REKAP PEMASUKAN KAS/BANK"; filterType = "Pemasukan"; }
    if (scope === 'EXPENSE') { reportTitle = "REKAP PENGELUARAN KAS/BANK"; filterType = "Pengeluaran"; }

    const reportData = (scope === 'ALL' 
        ? periodTransactions 
        : periodTransactions.filter(t => t.type === scope)
    ).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totalAmount = reportData.reduce((sum, item) => sum + item.amount, 0);
    const now = new Date();
    const printDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const branchName = settings.location_name;

    doc.setFontSize(8);
    doc.text(new Date().toLocaleString('en-US'), 10, 10);
    doc.text(`Laporan ${filterType} - ${branchName}`, 200, 10, { align: 'right' });
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reportTitle, 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode   :   ${periodText}`, 14, 30);
    doc.text(`Tanggal   :   ${printDate}`, 14, 35);
    doc.text(`Kantor    :   ${branchName}`, 14, 40);

    const tableBody: any[] = reportData.map((item, index) => {
        let description = `${item.description} (${item.category})`;
        if (item.paymentMethod === 'TRANSFER' && item.bankAccountId) {
            const bank = bankAccounts.find(b => b.id === item.bankAccountId);
            if (bank) description += `\n[Tujuan: ${bank.bankName} - ${bank.accountNumber}]`;
        }
        
        const amountPrefix = scope === 'ALL' ? (item.type === 'INCOME' ? '(+) ' : '(-) ') : '';
        
        return [
            index + 1, 
            { content: description, styles: { cellPadding: 2 } }, 
            { content: `${amountPrefix}Rp ${item.amount.toLocaleString('id-ID')}`, styles: { halign: 'right' } }
        ];
    });

    if (scope !== 'ALL') {
        tableBody.push(['', { content: 'Total', styles: { fontStyle: 'bold', halign: 'right' } }, { content: `Rp ${totalAmount.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold' } }]);
    } else {
        const income = reportData.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
        const expense = reportData.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
        tableBody.push(['', { content: 'Total Pemasukan', styles: { fontStyle: 'bold', halign: 'right' } }, { content: `Rp ${income.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [16, 185, 129] } }]);
        tableBody.push(['', { content: 'Total Pengeluaran', styles: { fontStyle: 'bold', halign: 'right' } }, { content: `Rp ${expense.toLocaleString('id-ID')}`, styles: { fontStyle: 'bold', textColor: [225, 29, 72] } }]);
        tableBody.push(['', { content: 'Selisih Periode', styles: { fontStyle: 'bold', halign: 'right' } }, { content: `Rp ${(income - expense).toLocaleString('id-ID')}`, styles: { fontStyle: 'bold' } }]);
    }

    autoTable(doc, { 
        startY: 45, 
        head: [['No.', 'Keterangan Transaksi', 'Jumlah (IDR)']], 
        body: tableBody, 
        theme: 'grid', 
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontStyle: 'bold' }, 
        bodyStyles: { textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] }, 
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 }, 
        columnStyles: { 0: { cellWidth: 15, halign: 'center' }, 1: { halign: 'left' }, 2: { cellWidth: 45 } } 
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    const yPos = finalY > 250 ? 20 : finalY;
    if (finalY > 250) doc.addPage();

    const pageWidth = doc.internal.pageSize.width;
    const boxWidth = 50; const boxHeight = 35; const marginX = (pageWidth - (boxWidth * 3)) / 4;
    const x1 = marginX; const x2 = marginX * 2 + boxWidth; const x3 = marginX * 3 + boxWidth * 2;
    doc.setLineWidth(0.1); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.rect(x1, yPos, boxWidth, boxHeight); doc.text("Membuat", x1 + boxWidth/2, yPos + 6, { align: 'center' }); doc.text("Admin", x1 + boxWidth/2, yPos + boxHeight - 5, { align: 'center' });
    doc.rect(x2, yPos, boxWidth, boxHeight); doc.text("Mengetahui", x2 + boxWidth/2, yPos + 6, { align: 'center' }); doc.text("Ketua RT / Koordinator", x2 + boxWidth/2, yPos + boxHeight - 5, { align: 'center' });
    doc.rect(x3, yPos, boxWidth, boxHeight); doc.text("Memverifikasi", x3 + boxWidth/2, yPos + boxHeight - 5, { align: 'center' }); doc.text("Bendahara", x3 + boxWidth/2, yPos + boxHeight - 5, { align: 'center' });
    
    doc.save(`Laporan_Kas_${scope}_${periodText.replace(/ /g, '_')}.pdf`);
    setShowExportMenu(false);
  };

  const handleOpenModal = (type: 'INCOME' | 'EXPENSE') => {
    setEditingTransactionId(null);
    let defaultDate = today;
    if (filterMode === 'DAILY') defaultDate = selectedDay;
    else if (filterMode === 'MONTHLY') defaultDate = new Date(selectedYear, selectedMonth - 1, new Date().getDate()).toISOString().split('T')[0];
    setFormData({ date: defaultDate, description: '', type: type, category: '', amount: 0, paymentMethod: 'CASH', bankAccountId: '' });
    setShowModal(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
      setEditingTransactionId(tx.id);
      setFormData({ date: tx.date, description: tx.description, type: tx.type, category: tx.category, amount: tx.amount, paymentMethod: tx.paymentMethod, bankAccountId: tx.bankAccountId || '' });
      setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
        await deleteTransaction(id);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsImporting(true);
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];
        let successCount = 0;
        for (const row of jsonData) {
            if (row.TANGGAL && row.JUMLAH) {
                let dateRaw = row.TANGGAL;
                if (typeof dateRaw === 'number') dateRaw = new Date(Math.round((dateRaw - 25569)*86400*1000)).toISOString().split('T')[0];
                const amount = parseInt(String(row.JUMLAH).replace(/\D/g,''));
                if (!isNaN(amount) && amount > 0) {
                    await addTransaction({ id: `tx-imp-${Date.now()}-${Math.random()}`, date: dateRaw, type: String(row.TIPE).toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE', category: row.KATEGORI || 'Umum', description: row.KETERANGAN || 'Import Data', amount, paymentMethod: String(row.METODE).trim().toUpperCase() === 'TRANSFER' ? 'TRANSFER' : 'CASH', bankAccountId: '' });
                    successCount++;
                }
            }
        }
        addNotification(`${successCount} Transaksi diimpor.`, "success"); setShowImportModal(false);
      } catch (error) { addNotification("Gagal impor file.", "error"); } finally { setIsImporting(false); if (importFileRef.current) importFileRef.current.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) { addNotification("Lengkapi data.", "warning"); return; }
    setIsSubmitting(true);
    try {
        const txData: Transaction = { id: editingTransactionId || `tx-${Date.now()}`, date: formData.date!, description: formData.description!, type: formData.type as 'INCOME' | 'EXPENSE', category: formData.category || 'Umum', amount: Number(formData.amount), paymentMethod: formData.paymentMethod as 'CASH' | 'TRANSFER', bankAccountId: formData.bankAccountId };
        if (editingTransactionId) await updateTransaction(txData); else await addTransaction(txData);
        setShowModal(false);
    } catch (error) { addNotification("Gagal menyimpan transaksi.", "error"); } finally { setIsSubmitting(false); }
  };

  const summaryBreakdown = useMemo(() => {
      const groups: Record<string, number> = {};
      periodTransactions.filter(t => t.type === summaryDetailType).forEach(t => { groups[t.category] = (groups[t.category] || 0) + t.amount; });
      return Object.entries(groups).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, summaryDetailType]);

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
           <h2 className="text-3xl font-black text-slate-800 tracking-tight">Buku Kas Harian</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pencatatan Pemasukan & Pengeluaran Operasional</p>
        </div>
        <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm self-start lg:self-auto overflow-x-auto no-scrollbar">
                <button onClick={() => setFilterMode('DAILY')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${filterMode === 'DAILY' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><Calendar size={14} /> Harian</button>
                <button onClick={() => setFilterMode('MONTHLY')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${filterMode === 'MONTHLY' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><Calendar size={14} /> Bulanan</button>
                <button onClick={() => setFilterMode('RANGE')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${filterMode === 'RANGE' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><CalendarRange size={14} /> Periode</button>
            </div>

            {filterMode === 'DAILY' && (
                <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-2 self-start lg:self-auto">
                    <input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} className="bg-transparent px-3 py-2 outline-none text-sm font-black text-slate-700 cursor-pointer" />
                </div>
            )}

            {filterMode === 'MONTHLY' && (
                <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-2 self-start lg:self-auto">
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent px-2 py-2 outline-none text-sm font-black text-slate-700 cursor-pointer">
                        {MONTHS.map((m, i) => { const isFuture = selectedYear === currentYear && (i + 1) > currentMonth; return <option key={i} value={i+1} disabled={isFuture}>{m}</option>; })}
                    </select>
                    <div className="w-[1px] h-6 bg-slate-200"></div>
                    <span className="bg-transparent px-3 py-2 text-sm font-black text-slate-700">{selectedYear}</span>
                </div>
            )}

            {filterMode === 'RANGE' && (
                <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 self-start lg:self-auto">
                    <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-slate-400 uppercase">Dari</span><input type="date" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} className="bg-slate-50 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 outline-none border border-slate-200" /></div>
                    <div className="hidden sm:block w-[1px] h-6 bg-slate-200"></div>
                    <div className="flex items-center gap-2"><span className="text-[9px] font-bold text-slate-400 uppercase">Sampai</span><input type="date" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} className="bg-slate-50 px-3 py-2 rounded-lg text-xs font-bold text-slate-700 outline-none border border-slate-200" /></div>
                </div>
            )}

            <div className="flex items-center space-x-2 self-start lg:self-auto">
                <button onClick={() => setShowImportModal(true)} className="bg-slate-100 text-slate-600 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-slate-200" title="Impor Data"><Upload size={16} /></button>
                
                <div className="relative" ref={exportMenuRef}>
                    <button 
                        onClick={() => setShowExportMenu(!showExportMenu)} 
                        className="bg-rose-50 text-rose-600 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border border-rose-100 hover:bg-rose-100 transition-colors"
                        title="Ekspor PDF"
                    >
                        <Printer size={16} /> <span className="hidden sm:inline">PDF</span> <ChevronDown size={12} />
                    </button>
                    {showExportMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                            <button onClick={() => handleExportPDF('ALL')} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-3"><PieChart size={14} className="text-indigo-500" /> Semua Transaksi</button>
                            <button onClick={() => handleExportPDF('INCOME')} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-3"><ArrowUpRight size={14} className="text-emerald-500" /> Hanya Pemasukan</button>
                            <button onClick={() => handleExportPDF('EXPENSE')} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-3"><ArrowDownLeft size={14} className="text-rose-500" /> Hanya Pengeluaran</button>
                        </div>
                    )}
                </div>

                <button onClick={() => handleOpenModal('EXPENSE')} className="bg-red-600 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><Plus size={16} /> Keluar</button>
                <button onClick={() => handleOpenModal('INCOME')} className="bg-emerald-600 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><Plus size={16} /> Masuk</button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div onClick={() => setShowBalanceDetailModal(true)} className="card p-5 border border-indigo-100 bg-indigo-50/50 flex flex-col justify-between min-h-[140px] cursor-pointer hover:shadow-lg transition-all group">
          <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><History size={12} /> Saldo Awal</p></div>
          <div className="mt-4">
              <p className="text-2xl font-black text-indigo-600">Rp {beginningBalance.toLocaleString('id-ID')}</p>
              <p className="text-[9px] font-bold text-indigo-400 mt-1">Per {filterMode === 'DAILY' ? new Date(selectedDay).toLocaleDateString('id-ID') : filterMode === 'MONTHLY' ? `1 ${MONTHS[selectedMonth-1]}` : new Date(dateRange.start).toLocaleDateString('id-ID')}</p>
          </div>
        </div>
        <div onClick={() => { setSummaryDetailType('INCOME'); setShowSummaryDetailModal(true); }} className="card p-5 border border-emerald-100 bg-emerald-50/50 flex flex-col justify-between min-h-[140px] cursor-pointer hover:shadow-lg transition-all">
          <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><ArrowUpRight size={12} /> TOTAL MASUK</p></div>
          <div className="mt-4"><p className="text-2xl font-black text-emerald-600">+ Rp {totalIncome.toLocaleString('id-ID')}</p></div>
        </div>
        <div onClick={() => { setSummaryDetailType('EXPENSE'); setShowSummaryDetailModal(true); }} className="card p-5 border border-red-100 bg-red-50/50 flex flex-col justify-between min-h-[140px] cursor-pointer hover:shadow-lg transition-all">
          <div><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><ArrowDownLeft size={12} /> TOTAL KELUAR</p></div>
          <div className="mt-4"><p className="text-2xl font-black text-rose-600">- Rp {totalExpense.toLocaleString('id-ID')}</p></div>
        </div>
        <div className="card p-5 bg-slate-900 text-white shadow-xl border-none relative overflow-hidden flex flex-col justify-between min-h-[140px]">
          <div className="relative z-10"><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><Wallet size={12} /> Saldo Akhir</p></div>
          <div className="relative z-10 mt-4">
              <p className="text-2xl font-black tracking-tight">Rp {endingBalance.toLocaleString('id-ID')}</p>
              <p className="text-[9px] font-bold text-slate-500 mt-1">Akumulasi Kas & Bank</p>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4"><Banknote size={100} /></div>
        </div>
      </div>

      <div className="card border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div className="flex bg-white p-1 rounded-2xl border border-slate-200">
                <button onClick={() => setTypeFilter('ALL')} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${typeFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Semua</button>
                <button onClick={() => setTypeFilter('INCOME')} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${typeFilter === 'INCOME' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>Pemasukan</button>
                <button onClick={() => setTypeFilter('EXPENSE')} className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${typeFilter === 'EXPENSE' ? 'bg-red-500 text-white' : 'text-slate-400'}`}>Pengeluaran</button>
            </div>
            <div className="relative w-full md:w-64"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} /><input type="text" placeholder="Cari..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none" /></div>
        </div>
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] sticky top-0 z-20">
              <tr>
                <th className="px-8 py-5">Tanggal</th>
                <th className="px-8 py-5">Keterangan</th>
                <th className="px-8 py-5">Kategori</th>
                <th className="px-8 py-5">Metode</th>
                <th className="px-8 py-5 text-right">Jumlah</th>
                <th className="px-8 py-5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedTransactions.length > 0 ? displayedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((t) => {
                  const targetBank = t.paymentMethod === 'TRANSFER' && t.bankAccountId 
                    ? bankAccounts.find(b => b.id === t.bankAccountId) 
                    : null;
                  
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5"><span className="text-xs font-black text-slate-600">{new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</span></td>
                        <td className="px-8 py-5">
                            <div className="font-bold text-slate-700 text-sm">{t.description}</div>
                            {targetBank && (
                                <div className="text-[10px] font-black text-blue-500 uppercase mt-1 flex items-center gap-1">
                                    {/* Added ArrowRight to lucide-react imports to fix compilation error on line 486 */}
                                    <ArrowRight size={10} /> {targetBank.bankName} - {targetBank.accountNumber}
                                </div>
                            )}
                        </td>
                        <td className="px-8 py-5"><span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest">{t.category}</span></td>
                        <td className="px-8 py-5">{t.paymentMethod === 'TRANSFER' ? <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Transfer</span> : <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">Tunai</span>}</td>
                        <td className={`px-8 py-5 text-right font-black text-sm ${t.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'INCOME' ? '+' : '-'} Rp {t.amount.toLocaleString('id-ID')}</td>
                        <td className="px-8 py-5"><div className="flex justify-center gap-2"><button onClick={() => handleOpenEditModal(t)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all" title="Ubah"><Edit size={14} /></button><button onClick={() => handleDelete(t.id)} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all" title="Hapus"><Trash2 size={14} /></button></div></td>
                    </tr>
                  );
                }) : (<tr><td colSpan={6} className="px-8 py-32 text-center text-slate-400 font-bold uppercase tracking-widest">Tidak ada transaksi ditemukan</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {showBalanceDetailModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
                      <div><h3 className="font-black text-indigo-900 text-lg">Rincian Saldo Awal</h3></div>
                      <button onClick={() => setShowBalanceDetailModal(false)} className="p-2 hover:bg-indigo-100 rounded-full text-indigo-400"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-600">Tunai / Cash</span>
                          <span className="font-black text-slate-800">Rp {balanceBreakdown.cash.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Posisi Rekening Bank (Mundur Akumulatif)</p>
                          {bankAccounts.map(acc => (
                              <div key={acc.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl">
                                  <span className="text-xs font-bold text-slate-700">{acc.bankName}</span>
                                  <span className="font-black text-slate-800">Rp {(balanceBreakdown.bankDetails[acc.id] || 0).toLocaleString('id-ID')}</span>
                              </div>
                          ))}
                      </div>
                      <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Akumulasi</span>
                          <span className="text-lg font-black text-indigo-600">Rp {beginningBalance.toLocaleString('id-ID')}</span>
                      </div>
                      <p className="text-[9px] text-center text-slate-400 italic">Nilai ini adalah akumulasi final per periode sebelumnya</p>
                  </div>
              </div>
          </div>
      )}

      {showSummaryDetailModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                  <div className={`p-6 border-b border-slate-100 flex justify-between items-center ${summaryDetailType === 'INCOME' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <h3 className="font-black text-lg text-slate-800">Rincian Kategori</h3>
                      <button onClick={() => setShowSummaryDetailModal(false)} className="p-2 rounded-full hover:bg-white/50 text-slate-400"><X size={20}/></button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-3">
                      {summaryBreakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl">
                              <span className="text-xs font-bold text-slate-600">{item.name}</span>
                              <span className={`font-black ${summaryDetailType === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>Rp {item.amount.toLocaleString('id-ID')}</span>
                          </div>
                      ))}
                  </div>
                  <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total</span>
                      <span className={`text-lg font-black ${summaryDetailType === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>Rp {(summaryDetailType === 'INCOME' ? totalIncome : totalExpense).toLocaleString('id-ID')}</span>
                  </div>
              </div>
          </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
           <div className="bg-white rounded-[2rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                 <h3 className="font-black text-slate-800 text-lg">{editingTransactionId ? 'Ubah Transaksi' : `Input ${formData.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}`}</h3>
                 <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-all"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tanggal</label><input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" /></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Keterangan</label><input type="text" required placeholder="Tulis rincian..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none" /></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Kategori</label><select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"><option value="">-- Pilih Kategori --</option>{(settings.transactionCategories || []).filter(c => c.type === formData.type).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}<option value="Umum">Umum / Lain-lain</option></select></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Jumlah (Rp)</label><input type="number" required value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-slate-800 outline-none" /></div>
                 <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Metode Pembayaran</label><div className="flex gap-3"><button type="button" onClick={() => setFormData({...formData, paymentMethod: 'CASH', bankAccountId: ''})} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${formData.paymentMethod === 'CASH' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400'}`}>Tunai</button><button type="button" onClick={() => setFormData({...formData, paymentMethod: 'TRANSFER'})} className={`flex-1 py-3 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all ${formData.paymentMethod === 'TRANSFER' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}>Transfer</button></div></div>
                 {formData.paymentMethod === 'TRANSFER' && (<div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pilih Bank</label><select required value={formData.bankAccountId} onChange={(e) => setFormData({...formData, bankAccountId: e.target.value})} className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl font-bold outline-none"><option value="">-- Pilih Rekening --</option>{bankAccounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountNumber}</option>))}</select></div>)}
                 <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">{isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}{editingTransactionId ? 'Simpan Perubahan' : 'Simpan Baru'}</button>
              </form>
           </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in duration-200 text-center p-8">
                <div className="w-16 h-16 bg-slate-50 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100"><FileText size={32} /></div>
                <h3 className="font-black text-slate-800 text-lg mb-2">Import Transaksi</h3>
                <p className="text-xs font-bold text-slate-400 mb-6 leading-relaxed">Gunakan template Excel (.xlsx). Pastikan format kolom sesuai.</p>
                <input type="file" ref={importFileRef} accept=".xlsx, .xls" className="hidden" onChange={handleImport} />
                <div className="space-y-3"><button onClick={() => importFileRef.current?.click()} disabled={isImporting} className="w-full py-3 bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-500/20 hover:bg-slate-900 flex items-center justify-center gap-2">{isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}<span>Pilih File Excel</span></button><button onClick={() => setShowImportModal(false)} className="w-full py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600">Batal</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
